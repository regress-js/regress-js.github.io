import Mexp from "math-expression-evaluator";
const mexp = new Mexp();


interface RegressionResult {
    b: number,
    a: number,
    sigma_b: number,
    sigma_a: number,
    sigma_stat: number,
    r: number,
    chi2: number,
    chi2red: number,
}

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

function regress(x: number[], y: number[], uy: number[]): RegressionResult {
    /* Modèle y = a + b*x (https://bupdoc.udppc.asso.fr/consultation/article-bup.php?ID_fiche=20802) */
    // Décider si les incertitudes sont rensignées, si non, prendre 1.
    const use_u = uy.filter(it => it != 0).length > 0;
    const u = use_u ? uy : Array(uy.length).fill(1);
    // Calculer les sommes permettant d'évaluer...
    let S11 = 0, Sx2 = 0, Sy2 = 0, Sxy = 0, Sx1 = 0, Sy1 = 0;  // ... a, b, ua, ub
    let xacc = 0, yacc = 0, SDxy = 0, SDx2 = 0, SDy2 = 0;  // ... r
    for (let i = 0; i < x.length; i++) {
        const w = u[i] == 0 ? Number.MAX_VALUE : 1 / Math.pow(u[i], 2);
        S11 += w;
        Sx1 += w * x[i];
        Sy1 += w * y[i];
        Sxy += w * x[i] * y[i];
        Sx2 += w * Math.pow(x[i], 2);
        Sy2 += w * Math.pow(y[i], 2);
        xacc += w * x[i];
        yacc += w * y[i];
    }
    // a et b
    const Delta = S11 * Sx2 - Math.pow(Sx1, 2);
    const a = (Sx2 * Sy1 - Sx1 * Sxy) / Delta;
    const b = (S11 * Sxy - Sx1 * Sy1) / Delta;
    // sigma stat
    let SDmod = 0;
    for (let i = 0; i < x.length; i++) {
        SDmod += Math.pow(y[i] - (a + b * x[i]), 2);
    }
    const sigma_stat = Math.sqrt(SDmod / (x.length - 2));
    const sigma_b = Math.sqrt(S11 / Delta) * (use_u ? 1 : sigma_stat);
    const sigma_a = Math.sqrt(Sx2 / Delta) * (use_u ? 1 : sigma_stat);
    // r
    for (let i = 0; i < x.length; i++) {
        const w = u[i] == 0 ? Number.MAX_VALUE : 1 / Math.pow(u[i], 2);
        SDxy += w * (x[i] - xacc/S11) * (y[i] - yacc/S11) / S11;
        SDx2 += w * Math.pow(x[i] - xacc/S11, 2) / S11;
        SDy2 += w * Math.pow(y[i] - yacc/S11, 2) / S11;
    }
    const r = SDxy / Math.sqrt(SDx2 * SDy2);
    // chi 2
    let chi2 = 0;
    for (let i = 0; i < x.length; i++) {
        chi2 += Math.pow((b*x[i]+a - y[i]) / u[i], 2)
    }
    const chi2red = chi2 / (x.length - 2);

    return {
        b: b, a: a, sigma_b: sigma_b, sigma_a: sigma_a, sigma_stat: sigma_stat, r: r, chi2: chi2, chi2red: chi2red,
    }
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
        this.formulasResults = [];
        this.inputFormulas.forEach(({ uuid, name, formula }: Formula) => {
            const columnResults: Variable = { uuid: uuid, name: name, values: [] };
            const inputVariables = Array.from(this.inputVariables).sort((a, b) => a.name.length - b.name.length).reverse();
            for (let row = 0; row < nRows; row++) {
                let rowFormula = formula;
                [...inputVariables, ...this.formulasResults].forEach(v => {
                    rowFormula = rowFormula.replaceAll(v.name, v.values[row].v);
                })
                let rowResult;
                try {
                    rowResult = mexp.postfixEval(mexp.toPostfix(mexp.lex(rowFormula))).toString();
                } catch (error) {
                    rowResult = undefined;
                }
                columnResults.values.push({ v: rowResult == undefined ? "#ERR" : rowResult.toString(), isInvalid: rowResult == undefined });
            }
            this.formulasResults.push(columnResults);
        })
    };
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
            for (let i = domain.inputVariables[column].values.length; i < row; i++) {
                domain.inputVariables[column].values[i].v = "";
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
        })
    }
    const inputTable = <HTMLTableElement> document.getElementById("input-table")!;
    drawTable("input-table", inputTable, domain.inputVariables);
    const computedTable = <HTMLTableElement> document.getElementById("computed-table");
    drawTable("computed-table", computedTable, domain.formulasResults);
}

class ChartData {
    x: number[] = [];
    y: number[] = [];
    ux: number[] = [];
    uy: number[] = [];
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
    setClassContentTo("eqn-abscisse", domain.selectedVariables.x);
    setClassContentTo("eqn-ordinate", domain.selectedVariables.y);
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
    var svgns = "http://www.w3.org/2000/svg";
    const svg = chart.getElementsByTagName("svg")[0];
    svg.setAttribute("height", `${(svg.clientWidth - 50)/1.618 + 20}px`);
    svg.innerHTML = "";
    const w = svg.getBoundingClientRect().width;
    const h = svg.getBoundingClientRect().height;
    
    const dataXmax = Math.max(...chartData.x);
    const dataXmin = Math.min(...chartData.x);
    const dataYmax = Math.max(...chartData.y);
    const dataYmin = Math.min(...chartData.y);
    const xmin = dataXmin - 0.05 * (dataXmax - dataXmin) - dataYmin/1000;
    const xmax = dataXmax + 0.05 * (dataXmax - dataXmin) + dataXmax/1000;
    const ymin = dataYmin - 0.05 * (dataYmax - dataYmin) - dataYmin/1000;
    const ymax = dataYmax + 0.05 * (dataYmax - dataYmin) + dataYmax/1000;

    function dataToPixel(x: number, y: number): number[] {
        const X = (x - xmin) / (xmax - xmin) * (w - 55) + 50;
        const Y = h - (y - ymin) / (ymax - ymin) * (h - 30) - 25;
        return [X, Y];
    }
    function pixelToData(X: number, Y: number): number[] {
        const x = X / w * (xmax - xmin);
        const y = Y / h * (ymax - ymin);
        return [x, y];
    }

    function drawLine(x1: number, y1: number, x2: number, y2: number, c: string): void {
        const [X1, Y1] = dataToPixel(x1, y1);
        const [X2, Y2] = dataToPixel(x2, y2);
        const line = document.createElementNS(svgns, 'line');
        line.setAttributeNS(null, 'x1', X1.toString());
        line.setAttributeNS(null, 'x2', X2.toString());
        line.setAttributeNS(null, 'y1', Y1.toString());
        line.setAttributeNS(null, 'y2', Y2.toString());
        line.setAttributeNS(null, 'stroke', c);
        svg.appendChild(line);
    }

    function drawText(x: number, y: number, value: string, align: string, valign: string): void {
        const [X, Y] = dataToPixel(x, y);
        const text = document.createElementNS(svgns, 'text');
        text.setAttributeNS(null, 'x', X.toString());
        text.setAttributeNS(null, 'y', Y.toString());
        text.setAttributeNS(null, 'text-anchor', align);
        text.setAttributeNS(null, 'dominant-baseline', valign);
        text.textContent = value;
        text.classList.add("xtick");
        svg.appendChild(text);
    }

    function drawDataPoint(x: number, y: number, ux: number, uy: number, c: string): void {
        const barsize = pixelToData(3, 3);
        const uxsize = Math.max(ux, barsize[0]);
        const uysize = Math.max(uy, barsize[1]);
        drawLine(Math.max(xmin, x-uxsize), y, Math.min(xmax, x+uxsize), y, c);
        drawLine(x, Math.max(ymin, y-uysize), x, Math.min(ymax, y+uysize), c);
        if (uxsize == ux) {
            drawLine(x-uxsize, y-barsize[1], x-uxsize, y+barsize[1], c);
            drawLine(x+uxsize, y-barsize[1], x+uxsize, y+barsize[1], c);
        }
        if (uysize == uy) {
            drawLine(x-barsize[0], y-uysize, x+barsize[0], y-uysize, c);
            drawLine(x-barsize[0], y+uysize, x+barsize[0], y+uysize, c);
        }
    }

    function drawXAxisTick(x: number, y: number, c: string): void {
        const barsize = pixelToData(6, 6)[1];
        drawLine(x, y-barsize, x, y, c);
        drawText(x, y-barsize*2, x.toString(), 'middle', 'hanging');
    }

    function drawYAxisTick(x: number, y: number, c: string): void {
        const barsize = pixelToData(6, 6)[0];
        drawLine(x-barsize, y, x, y, c);
        drawText(x-barsize*2, y, y.toString(), 'end', 'central');
    }

    function drawDot(x: number, y: number, s: number, c: string): void {
        if (!Number.isFinite(x) || !Number.isFinite(y) || Number.isNaN(x) || Number.isNaN(y))
            return;
        const [X, Y] = dataToPixel(x, y);
        const dot = document.createElementNS(svgns, 'circle');
        dot.setAttributeNS(null, 'cx', X.toString());
        dot.setAttributeNS(null, 'cy', Y.toString());
        dot.setAttributeNS(null, 'r', s.toString());
        dot.setAttributeNS(null, 'fill', c);
        svg.appendChild(dot);
    }

    function divideRange(min: number, max: number, divisions: number) {
        const range = max - min;
        const exactDivider = range / divisions;
        // get n such that exactDivider can be written as d.xyz * 10^n where d is a one-digit integer
        const dividerDecimalExponent = Math.floor(Math.log10(exactDivider));
        // then get 10^n
        const dividerDecimalMagnitude = Math.pow(10, dividerDecimalExponent);
        // prepare didiver options as 1, 2 or 5 multiplied by 10^n
        const dividerOptions = [1, 2, 5].map(k => k * dividerDecimalMagnitude);
        // find option closest to exactDivier
        const divider = dividerOptions.sort((a, b) => Math.abs(a - exactDivider) - Math.abs(b - exactDivider))[0];
        // compute tick values
        const ticks: number[] = [];
        const subticks: number[] = [];
        for (let i = Math.floor(min / divider); i <= Math.ceil(max / divider); i++) {
            const tick = i * divider;
            if (min < tick && tick < max) ticks.push(tick);
            for (let j = 1; j < divisions; j++) {
                const subtick = tick + j * divider / divisions;
                if (min < subtick && subtick < max) subticks.push(subtick)
            }
        }
        return [ticks, subticks];
    }

    const [xTicks, xSubticks] = divideRange(xmin, xmax, 5);
    const [yTicks, ySubticks] = divideRange(ymin, ymax, 5);
    // gridlines
    xSubticks.forEach(x => drawLine(x, ymin, x, ymax, "lightgray"));
    ySubticks.forEach(y => drawLine(xmin, y, xmax, y, "lightgray"));
    xTicks.forEach(x => drawLine(x, ymin, x, ymax, "gray"));
    yTicks.forEach(y => drawLine(xmin, y, xmax, y, "gray"));
    // ticks
    xTicks.forEach(x => drawXAxisTick(x, ymin, "black"));
    yTicks.forEach(y => drawYAxisTick(xmin, y, "black"));
    // axes
    drawLine(xmin, ymin, xmax, ymin, 'black');
    drawLine(xmin, ymin, xmin, ymax, 'black');
    drawLine(xmin, ymax, xmax, ymax, 'black');
    drawLine(xmax, ymin, xmax, ymax, 'black');

    for (let j = 0; j < x.values.length; j++) {
        const xValue = Number(x.values[j].v);
        const yValue = Number(y.values[j].v);
        const xInvalid = x.values[j].isInvalid;
        const yInvalid = y.values[j].isInvalid;
        if (!xInvalid && !yInvalid)
            drawDataPoint(xValue, yValue, Number(chartData.ux[j]), Number(chartData.uy[j]), 'blue');
    }
    drawLine(xmin, regres.a + regres.b * xmin, xmax, regres.a + regres.b * xmax, 'blue');
}

function draw() {
    domain.computeFormulas();
    drawTables();
    drawChart();
}
draw();
window.onresize = () => { drawChart(); }
