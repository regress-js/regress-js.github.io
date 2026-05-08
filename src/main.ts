import Mexp from "math-expression-evaluator";
const mexp = new Mexp();

import { v4 as uuidv4 } from "uuid";

import { ChartData, updateChart } from "./chart";
import { RegressionResult, regress } from "./regression";

function setClassContentTo(cls: string, value: string): void {
    const elements = document.getElementsByClassName(cls);
    for (let i = 0; i < elements.length; i++) {
        elements.item(i).textContent = value;
    }
}


function keep_digits(n: number, x: number, other?: number) {
    if (x == 0)
        if (other)
            return other.toString();
        else
            return (0).toString();
    const decimal_shift = Math.ceil(-Math.log10(Math.abs(x)));
    const power = Math.pow(10, decimal_shift + n - 1);
    if (other)
        return (Math.round(other * power) / power).toFixed(Math.max(decimal_shift + n - 1, 0));
    return (Math.round(x * power) / power).toFixed(Math.max(decimal_shift + n - 1, 0));
}


function getElementByIdOrCreate(tagName: string, parent: HTMLElement, id: string) {
    const element = document.getElementById(`${id}`);
    if (element)
        return element;
    const created = document.createElement(tagName);
    created.id = id;
    parent.appendChild(created);
    return created;
}

type UserInput = string;
type ArrayValue = { v: UserInput, isInvalid: boolean };
type Variable = { uuid: string, name: string, values: ArrayValue[] };
type Formula = { uuid: string, name: string, formula: string };

class Domain {
    inputVariables: Variable[] = [
        { uuid: "a", name: "X", values: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"].map(v => ({ v: v, isInvalid: false}))},
        { uuid: "b", name: "Y", values: ["14.79", "33.52", "36.50", "51.88", "63.11", "66.94", "74.58", "92.46", "89.50", "109.29", "117.40", "118.37"].map(v => ({ v: v, isInvalid: false}))},
    ];
    inputFormulas: Formula[] = [
        { uuid: "c", name: "u(X)", formula: "sin(X)" },
        { uuid: "d", name: "u(Y)", formula: "0.1*Y"}
    ];
    formulasResults: Variable[] = [];
    selectedVariables: { x: string, ux: string, y: string, uy: string } = { x: "a", ux: "c", y: "b", uy: "d" };
    computeFormulas() : void {
        const nRows = this.getNRows();
        this.inputVariables.forEach((variable) => {
            for (let i = variable.values.length; i < nRows; i++) {
                variable.values.push({ v: "", isInvalid: true });
            }
            variable.values.forEach((value) => {
                value.isInvalid = isNaN(parseFloat(value.v));
            })
        })
        this.formulasResults = [];
        this.inputFormulas.forEach(({ uuid, name, formula }: Formula) => {
            const columnResults: Variable = { uuid: uuid, name: name, values: [] };
            const tokens = this.getVariables().map(v => ({ "token": v.name, "type": 3, "value": v.name, "show": v.name, "precedence": 100 }));
            for (let row = 0; row < nRows; row++) {
                const values: Record<string, number> = Object.assign({}, ...this.getVariables().map(v => ({ [v.name]: Number(v.values[row].v) }) ));
                try {
                    const rowResult = mexp.eval(formula, tokens, values);
                    columnResults.values.push({ v: rowResult == undefined ? "#ERR" : rowResult.toString(), isInvalid: rowResult == undefined });
                } catch (error) {
                    columnResults.values.push({ v: "#ERR", isInvalid: true });
                }
            }
            this.formulasResults.push(columnResults);
        })
    };
    newColumn(index: number, table: string) {
        if (table == "input-table") {
            this.inputVariables.splice(index, 0,
                { uuid: uuidv4(), name: "n", values: this.inputVariables[0].values.map(() => ({ v: "", isInvalid: true})) }
            )
        } else {
            this.inputFormulas.splice(index, 0,
                { uuid: uuidv4(), name: "n", formula: "" }
            )
        }
    }
    getNRows() : number {
        return Math.max(...this.inputVariables?.map((a) => a.values.length));
    }
    getVariables() : Variable[] {
        return [...this.inputVariables, ...this.formulasResults];
    }
    getVariableByUUID(uuid: string) : Variable | undefined {
        return this.getVariables().find(v => v.uuid == uuid);
    }
}

const domain = new Domain();

function makeEditableStringCell(key: string, column: number) {
    const inputField = <HTMLInputElement> document.getElementById("input-table-field")!;
    inputField.blur();
    const cell = <HTMLTableCellElement> document.getElementById(`${key}-header-row-var-${column}`);
    if (!cell) return false;
    cell.classList.add("selected");
    inputField.value = cell.textContent;
    inputField.focus();
    inputField.setSelectionRange(0, inputField.value.length);
    inputField.onblur = () => {
        cell.classList.remove("selected");
        inputField.value = "";
        inputField.onblur = null;
    }
    function validate() {
        domain.inputVariables[column].name = inputField.value.trim();
        draw();
    }
    inputField.onkeydown = (e) =>{
        if ((e.key === "Enter" || e.key === "Tab")) {
            e.preventDefault();
            validate();
            inputField.blur();
            return;
        }
    }
}

function makeEditableFormulaCell(key: string, column: number) {
    const inputField = <HTMLInputElement> document.getElementById("input-table-field")!;
    inputField.blur();
    const cell = <HTMLTableCellElement> document.getElementById(`${key}-header-row-var-${column}`);
    if (!cell) return false;
    cell.classList.add("selected");
    inputField.value = cell.textContent + " = " + domain.inputFormulas[column].formula;
    inputField.focus();
    inputField.setSelectionRange(0, inputField.value.length);
    inputField.onblur = () => {
        cell.classList.remove("selected");
        inputField.value = "";
        inputField.onblur = null;
    }
    function validate() {
        const [n, f] = inputField.value.split("=");
        domain.inputFormulas[column].name = n.trim();
        domain.inputFormulas[column].formula = f.trim();
        draw();
    }
    inputField.oninput = () => {}
    inputField.onkeydown = (e) =>{
        if ((e.key === "Enter" || e.key === "Tab")) {
            e.preventDefault();
            validate();
            inputField.blur();
            return;
        }
    }
}

function makeEditableNumberCell(key: string, column: number, row: number) {
    const inputField = <HTMLInputElement> document.getElementById("input-table-field")!;
    inputField.blur();
    const cell = <HTMLTableCellElement> document.getElementById(`${key}-value-row-${row}-variable-${column}`);
    if (!cell) return false;
    cell.classList.add("selected");
    inputField.value = cell.textContent;
    inputField.focus();
    inputField.setSelectionRange(0, inputField.value.length);
    inputField.onblur = () => {
        cell.classList.remove("selected");
        inputField.value = "";
        inputField.onkeyup = null;
        inputField.onkeydown = null;
        inputField.onblur = null;
    }
    function validate() {
        if (cell.parentElement!.nextSibling == null && inputField.value.length == 0) return;
        if (row >= domain.inputVariables[column].values.length) {
            for (let i = domain.inputVariables[column].values.length; i <= row; i++) {
                domain.inputVariables[column].values[i] = { v: "", isInvalid: true };
            }
        }
        domain.inputVariables[column].values[row].v = inputField.value;
        draw();
    }
    inputField.oninput = (e) => {
        validate();
    }
    inputField.onkeydown = (e) => {
        if ((e.key === "Enter" && !e.getModifierState("Shift")) || e.key === "ArrowDown") {
            e.preventDefault();
            validate();
            inputField.blur();
            const ok = makeEditableNumberCell(key, column, row + 1);
            if (!ok) makeEditableNumberCell(key, column, row);
            return;
        }
        if ((e.key === "Enter" && e.getModifierState("Shift")) || e.key === "ArrowUp") {
            e.preventDefault();
            validate();
            inputField.blur();
            const ok = makeEditableNumberCell(key, column, row - 1);
            if (!ok) makeEditableNumberCell(key, column, row);
            return;
        }
        if ((e.key === "Tab" && !e.getModifierState("Shift")) || (e.key === "ArrowRight" && e.getModifierState("Shift"))) {
            e.preventDefault();
            validate();
            inputField.blur();
            const ok = makeEditableNumberCell(key, column + 1, row);
            if (!ok) makeEditableNumberCell(key, 0, row + 1);
            return;
        }
        if ((e.key === "Tab" && e.getModifierState("Shift")) || (e.key === "ArrowLeft" && e.getModifierState("Shift"))) {
            e.preventDefault();
            validate();
            inputField.blur();
            let ok = makeEditableNumberCell(key, column - 1, row);
            if (!ok) ok = makeEditableNumberCell(key, domain.inputVariables.length - 1, row - 1);
            if (!ok) ok = makeEditableNumberCell(key, 0, 0);
            return;
        }
    }
    return true;
}

function drawTables() {
    function drawTable(key: string, table: HTMLTableElement, arrays: { name: string, values: { v: UserInput, isInvalid: boolean }[] }[]) {
        arrays.forEach((array, i) => {
            const headerRow = <HTMLTableRowElement> getElementByIdOrCreate("tr", table, `${key}-header-row`);
            const headerCell = <HTMLTableCellElement> getElementByIdOrCreate("th", headerRow, `${key}-header-row-var-${i}`);
            headerCell.textContent = array.name;
            if (key == "input-table") headerCell.onclick = () => { makeEditableStringCell(key, i) };
            if (key == "computed-table") headerCell.onclick = () => { makeEditableFormulaCell(key, i) };
            array.values.forEach((value, j) => {
                const row = <HTMLTableRowElement> getElementByIdOrCreate("tr", table, `${key}-value-row-${j}`);
                const cell = <HTMLTableCellElement> getElementByIdOrCreate("td", row, `${key}-value-row-${j}-variable-${i}`);
                cell.textContent = value.v;
                if (value.isInvalid)
                    cell.classList.add("input-value-invalid");
                else
                    cell.classList.remove("input-value-invalid");
                if (key == "input-table") cell.onclick = () => { makeEditableNumberCell(key, i, j) };
            })
            const lastRow = <HTMLTableRowElement> getElementByIdOrCreate("tr", table, `${key}-value-row-${array.values.length}`);
            const lastCell = <HTMLTableCellElement> getElementByIdOrCreate("td", lastRow, `${key}-value-row-${array.values.length}-variable-${i}`);
            if (key == "input-table") lastCell.onclick = () => { makeEditableNumberCell(key, i, array.values.length) };
        });
        const adder = getElementByIdOrCreate("div", table, "column-adder");
        adder.parentElement!.removeChild(adder);
        table.parentElement!.appendChild(adder);
        [...table.rows].forEach((row) => { [...row.cells].forEach((cell, index) => {
            cell.onmouseenter = () => {
                cell.onmousemove = (ev) => {
                    const mouseX = ev.pageX;
                    const cellRect = cell.getBoundingClientRect();
                    const tableRect = table.getBoundingClientRect();
                    const wrapperRect = table.parentElement!.getBoundingClientRect();
                    adder.style.top = tableRect.top + "px";
                    if (mouseX < cellRect.left + cellRect.width/4) {
                        adder.style.visibility = "visible";
                        adder.style.left = (cellRect.left - wrapperRect.left - adder.getBoundingClientRect().width/2) + "px";
                        adder.dataset.colIndex = index.toString();
                        adder.dataset.table = key;
                    } else if (mouseX > cellRect.left + 3*cellRect.width/4) {
                        adder.style.visibility = "visible";
                        adder.style.left = (cellRect.right - wrapperRect.left - adder.getBoundingClientRect().width/2) + "px";
                        adder.dataset.colIndex = (index + 1).toString();
                        adder.dataset.table = key;
                    } else {
                        adder.style.visibility = "hidden";
                    }
                }
            }
            cell.onmouseleave = () => {
                cell.onmousemove = null;
            };
        })});
        table.onmouseleave = (ev) => {
            adder.style.visibility = "hidden";
        };
        adder.onmouseenter = () => {
            adder.style.visibility = "visible";
        }
        adder.onclick = () => {
            const newColIndex = adder.dataset.colIndex!;
            const newColTable = adder.dataset.table!;
            domain.newColumn(Number(newColIndex), newColTable);
            domain.computeFormulas();
            drawTables();
        }
    }
    const inputTable = <HTMLTableElement> document.getElementById("input-table")!;
    drawTable("input-table", inputTable, domain.inputVariables);
    const computedTable = <HTMLTableElement> document.getElementById("computed-table");
    drawTable("computed-table", computedTable, domain.formulasResults);
}

function drawChart() {
    const selectors: [string, (arg0: string) => void, () => string][] = [
        ["abscisse-select", (v: string) => domain.selectedVariables.x = v, () => domain.selectedVariables.x],
        ["ordinate-select", (v: string) => domain.selectedVariables.y = v, () => domain.selectedVariables.y],
        ["u-abscisse-select", (v: string) => domain.selectedVariables.ux = v, () => domain.selectedVariables.ux],
        ["u-ordinate-select", (v: string) => domain.selectedVariables.uy = v, () => domain.selectedVariables.uy]
    ];
    selectors.forEach(([id, set, get]) => {
        const selector = <HTMLSelectElement> document.getElementById(id);
        if (id[0] == "u") {
            const nullOption = <HTMLOptionElement> getElementByIdOrCreate("option", selector, `${id}-option-null`);
            nullOption.textContent = "";
            nullOption.value = "null";
        }
        domain.getVariables().forEach((variable, i) => {
            const option = <HTMLOptionElement> getElementByIdOrCreate("option", selector, `${id}-option-${i}`);
            option.textContent = variable.name;
            option.value = variable.uuid;
        });
        selector.onchange = (event) => { set(selector.value); drawChart(); };
        selector.value = get();
    });

    const x = domain.getVariableByUUID(domain.selectedVariables.x);
    const y = domain.getVariableByUUID(domain.selectedVariables.y);
    const ux = domain.selectedVariables.ux == "null" ? "null" : domain.getVariableByUUID(domain.selectedVariables.ux);
    const uy = domain.selectedVariables.uy == "null" ? "null" : domain.getVariableByUUID(domain.selectedVariables.uy);
    if (x == undefined || y == undefined || ux == undefined || uy == undefined) return;

    const chartData = new ChartData();
    for (let row = 0; row < domain.getNRows(); row++) {
        if (x.values[row].isInvalid || y.values[row].isInvalid || (ux != "null" && ux.values[row].isInvalid) || (uy != "null" && uy.values[row].isInvalid))
            continue;
        chartData.x.push(Number(x.values[row].v));
        chartData.y.push(Number(y.values[row].v));
        chartData.ux.push(ux == "null" ? 0 : Number(ux.values[row].v));
        chartData.uy.push(uy == "null" ? 0 : Number(uy.values[row].v));
    }

    const regres = regress(chartData.x, chartData.y, chartData.uy);
    setClassContentTo("eqn-abscisse", domain.getVariableByUUID(domain.selectedVariables.x)!.name);
    setClassContentTo("eqn-ordinate", domain.getVariableByUUID(domain.selectedVariables.y)!.name);
    setClassContentTo("eqn-intercept-value", keep_digits(3, regres.sigma_a, regres.a));
    setClassContentTo("eqn-intercept-uncertainty", keep_digits(3, regres.sigma_a));
    setClassContentTo("eqn-slope-value", keep_digits(3, regres.sigma_b, regres.b));
    setClassContentTo("eqn-slope-uncertainty", keep_digits(3, regres.sigma_b));
    setClassContentTo("eqn-r-value", keep_digits(2, 1-regres.r, regres.r));
    setClassContentTo("eqn-r2-value", keep_digits(2, 1-regres.r, Math.pow(regres.r, 2)));
    setClassContentTo("eqn-sigmastat-value", keep_digits(3, regres.sigma_stat));
    setClassContentTo("eqn-chi2-value", keep_digits(3, regres.chi2));
    setClassContentTo("eqn-chi2red-value", keep_digits(3, regres.chi2red));

    const chart = document.getElementById("chart")!;
    const svg = chart.getElementsByTagName("svg")[0];
    updateChart(svg, chartData, regres);
}

function draw() {
    domain.computeFormulas();
    drawTables();
    drawChart();
}
draw();
window.onresize = () => { drawChart(); }
