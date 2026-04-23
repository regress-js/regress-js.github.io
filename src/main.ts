import Mexp from "math-expression-evaluator";
const mexp = new Mexp();

interface Data {
    variables: string[],
    values: string[][],
    uncertainties: string[][],
    uncertainty_forumlas: string[],
    show_uncertainties: boolean[],
    use_uncertainties: boolean[],
}

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

let data: Data = {
    variables: ["X", "Y"],
    values: [["0", "14.79"], ["2", "33.52"], ["4", "36.50"], ["6", "51.88"], ["8", "63.11"], ["10", "66.94"], ["12", "74.58"], ["14", "92.46"], ["16", "89.50"], ["18", "109.29"], ["20", "117.40"], ["22", "118.37"]],
    uncertainties: [["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"], ["0", "5"]],
    uncertainty_forumlas: ["", ""],
    show_uncertainties: [true, true],
    use_uncertainties: [false, true],
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

type userNumber = string;

interface DomainData {
    arrays: { name: string, values: userNumber[] }[],
    formulas: { name: string, formula: string }[],
    selectedForChart: [number, number, number, number],
}

class OutputData {
    inputArrays: { name: string, values: { v: userNumber, isInvalid: boolean }[] }[] = [];
    computedArrays: { name: string, values: { v: userNumber, isInvalid: boolean }[] }[] = [];
}

const exampleDomainData: DomainData = {
    arrays: [
        { name: "X", values: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"] },
        { name: "Y", values: ["14.79", "33.52", "36.50", "51.88", "63.11", "66.94", "74.58", "92.46", "89.50", "109.29", "117.40", "118.37"] }],
    formulas: [{ name: "u(X)", formula: "sin(X)" }, { name: "u(Y)", formula: "0.1*Y"}],
    selectedForChart: [0, 2, 1, 3],
}    

function processDomain(input: DomainData) : OutputData {
    let finishedArrays: { name: string, values: { v: userNumber, isInvalid: boolean }[] }[] = [];
    let output: OutputData = new OutputData();
    const dataLength = Math.max(...input.arrays.map((a) => a.values.length));
    input.arrays.forEach((variable, i) => {
        const values: { v: userNumber, isInvalid: boolean }[] = [];
        const array = { name: variable.name, values: values };
        output.inputArrays.push(array);
        variable.values.forEach((value, j) => {
            array.values.push({
                v: value,
                isInvalid: (value == undefined) || (value.length == 0) || !Number.isFinite(Number(value))
            })
        })
        for (let j = variable.values.length; j < dataLength; j++) {
            array.values.push({
                v: "",
                isInvalid: true,
            })
        }
        finishedArrays.push(array);
    })
    finishedArrays = finishedArrays.sort((a, b) => a.name.length - b.name.length).reverse();
    console.log(finishedArrays);
    exampleDomainData.formulas.forEach((formula, i) => {
        const values: { v: userNumber, isInvalid: boolean }[] = [];
        const array = { name: formula.name, values: values };
        for (let row = 0; row < dataLength; row++) {
            let cellExpression = formula.formula;
            finishedArrays.forEach((array) => {
                cellExpression = cellExpression.replaceAll(array.name, Number(array.values[row].v).toString());
            })
            let value: number | undefined;
            try {
                value = mexp.postfixEval(mexp.toPostfix(mexp.lex(cellExpression)));
            } catch (error) {
                value = undefined;
            }
            values.push({ v: value != undefined ? value.toString() : "#ERR", isInvalid: value == undefined });
        }
        output.computedArrays.push(array);
        finishedArrays.push(array);
    })
    return output;
}

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
        exampleDomainData.arrays[column].name = inputField.value.trim();
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
    inputField.value = cell.textContent + " = " + exampleDomainData.formulas[column].formula;
    inputField.focus();
    inputField.setSelectionRange(0, inputField.value.length);
    inputField.onblur = () => {
        cell.classList.remove("selected");
        inputField.value = "";
        inputField.onblur = null;
    }
    function validate() {
        const [n, f] = inputField.value.split("=");
        exampleDomainData.formulas[column].name = n.trim();
        exampleDomainData.formulas[column].formula = f.trim();
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
        if (row >= exampleDomainData.arrays[column].values.length) {
            for (let i = exampleDomainData.arrays[column].values.length; i < row; i++) {
                exampleDomainData.arrays[column].values[i] = "";
            }
        }
        exampleDomainData.arrays[column].values[row] = inputField.value;
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
            if (!ok) ok = makeEditableNumberCell(key, exampleDomainData.arrays.length - 1, row - 1);
            if (!ok) ok = makeEditableNumberCell(key, 0, 0);
            return;
        }
    }
    return true;
}

function drawTables(data: OutputData) {
    function drawTable(key: string, table: HTMLTableElement, arrays: { name: string, values: { v: userNumber, isInvalid: boolean }[] }[]) {
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
    drawTable("input-table", inputTable, data.inputArrays);
    const computedTable = <HTMLTableElement> document.getElementById("computed-table");
    drawTable("computed-table", computedTable, data.computedArrays);
}

function drawChart(data: OutputData) {

    const abscisseSelector = <HTMLSelectElement> document.getElementById("abscisse-select")!;
    const ordinateSelector = <HTMLSelectElement> document.getElementById("ordinate-select")!;
    const uAbscisseSelector = <HTMLSelectElement> document.getElementById("u-abscisse-select")!;
    const uOrdinateSelector = <HTMLSelectElement> document.getElementById("u-ordinate-select")!;
    [...data.inputArrays, ...data.computedArrays].forEach((array, i) => {
        const abscisseOption = <HTMLOptionElement> getElementByIdOrCreate("option", abscisseSelector, `abscisse-option-${i}`);
        abscisseOption.textContent = array.name;
        const ordinateOption = <HTMLOptionElement> getElementByIdOrCreate("option", ordinateSelector, `ordinate-option-${i}`);
        ordinateOption.textContent = array.name;
        const uAbscisseOption = <HTMLOptionElement> getElementByIdOrCreate("option", uAbscisseSelector, `u-abscisse-option-${i}`);
        uAbscisseOption.textContent = array.name;
        const uOrdinateOption = <HTMLOptionElement> getElementByIdOrCreate("option", uOrdinateSelector, `u-ordinate-option-${i}`);
        uOrdinateOption.textContent = array.name;
    })
    abscisseSelector.onchange = (e) => { exampleDomainData.selectedForChart[0] = abscisseSelector.selectedIndex; draw() };
    ordinateSelector.onchange = (e) => { exampleDomainData.selectedForChart[2] = ordinateSelector.selectedIndex; draw() };
    uAbscisseSelector.onchange = (e) => { exampleDomainData.selectedForChart[1] = uAbscisseSelector.selectedIndex; draw() };
    uOrdinateSelector.onchange = (e) => { exampleDomainData.selectedForChart[3] = uOrdinateSelector.selectedIndex; draw() };
    const selectedAbscisse = exampleDomainData.selectedForChart[0];
    const selectedOrdinate = exampleDomainData.selectedForChart[2];
    const selectedUAbscisse = exampleDomainData.selectedForChart[1];
    const selectedUOrdinate = exampleDomainData.selectedForChart[3];
    abscisseSelector.selectedIndex = selectedAbscisse;
    ordinateSelector.selectedIndex = selectedOrdinate;
    uAbscisseSelector.selectedIndex = selectedUAbscisse;
    uOrdinateSelector.selectedIndex = selectedUOrdinate;

    const x = [...data.inputArrays, ...data.computedArrays][selectedAbscisse].name;
    const y = [...data.inputArrays, ...data.computedArrays][selectedOrdinate].name;
    const ux = [...data.inputArrays, ...data.computedArrays][selectedUAbscisse].name;
    const uy = [...data.inputArrays, ...data.computedArrays][selectedUOrdinate].name;
    const xArray = [data.inputArrays, data.computedArrays].flatMap((array) => array).find((array) => array.name == x);
    const yArray = [data.inputArrays, data.computedArrays].flatMap((array) => array).find((array) => array.name == y);
    const uxArray = [data.inputArrays, data.computedArrays].flatMap((array) => array).find((array) => array.name == ux);
    const uyArray = [data.inputArrays, data.computedArrays].flatMap((array) => array).find((array) => array.name == uy);
    if (xArray == undefined || yArray == undefined || uxArray == undefined || uyArray == undefined) return;

    const regres = regress(xArray.values.map(x => Number(x.v)), yArray.values.map(y => Number(y.v)), uyArray.values.map(y => Number(y.v)));
    setClassContentTo("eqn-abscisse", x);
    setClassContentTo("eqn-ordinate", y);
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
    
    const xValues = xArray.values.flatMap((v) => Number(v.v)).filter((n) => Number.isFinite(n));
    const yValues = yArray.values.flatMap((v) => Number(v.v)).filter((n) => Number.isFinite(n));
    const dataXmax = Math.max(...xValues);
    const dataXmin = Math.min(...xValues);
    const dataYmax = Math.max(...yValues);
    const dataYmin = Math.min(...yValues);
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
        console.log(range, exactDivider, divider);
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

    for (let j = 0; j < xArray.values.length; j++) {
        const xValue = Number(xArray.values[j].v);
        const yValue = Number(yArray.values[j].v);
        const xInvalid = xArray.values[j].isInvalid;
        const yInvalid = yArray.values[j].isInvalid;
        if (!xInvalid && !yInvalid)
            drawDataPoint(xValue, yValue, Number(uxArray.values[j].v), Number(uyArray.values[j].v), 'blue');
    }
    drawLine(xmin, regres.a + regres.b * xmin, xmax, regres.a + regres.b * xmax, 'blue');
}

function draw() {
    drawTables(processDomain(exampleDomainData));
    drawChart(processDomain(exampleDomainData));
}
draw();
window.onresize = () => { drawChart(processDomain(exampleDomainData))}
