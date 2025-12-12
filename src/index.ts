import * as e from 'express';
import './app.css'; // referencing .css file

interface Data {
    variables: string[],
    values: string[][],
    uncertainties: string[][],
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
    show_uncertainties: [true, true],
    use_uncertainties: [false, true],
}


function setClassContentTo(cls: string, value: string): void {
    const elements = document.getElementsByClassName(cls);
    for (let i = 0; i < elements.length; i++) {
        elements.item(i).textContent = value;
    }
}

function getOrCreateElementWithId(tagName: string, id: string, parent: HTMLElement): HTMLElement {
  let result = document.getElementById(id);
  if (result != undefined) return result;
  result = document.createElement(tagName);
  result.id = id;
  parent.appendChild(result);
  return result;
}

function tableCellId(row: number, col: number, specifier: string) {
    return 'data-row-' + row + '-' + specifier + '-' + col;
}

let cellIdToFocus: string = "";
let inputHappendInFocusedCell: boolean = false;
let storedFocusesCellValue: string = "";
function focusTableCell(row: number, col: number, specifier: string) {
    cellIdToFocus = tableCellId(row, col, specifier)
    const target = document.getElementById(cellIdToFocus);
    if (target) {
        target.focus();
        return target;
    }
}

function addCellToRow(textContent: string, i: number, j: number, specifier: string, row: HTMLTableRowElement, action: (e: Event, s: string) => undefined) {
    const cellId = tableCellId(i, j, specifier);
    const cell = getOrCreateElementWithId('td', cellId, row);
    cell.contentEditable = "plaintext-only";
    cell.classList.add("data-cell");
    cell.innerHTML = textContent + "<br/>";
    cell.onblur = (e) => {
        action(e, cell.textContent);
        redraw();
    }
    const moveDown = () => { focusTableCell(i+1, j, specifier); }
    const moveUp = () => { focusTableCell(i-1, j, specifier); }
    const moveLeft = () => {
        if (specifier == 'uncertainty')
            focusTableCell(i, j, 'variable');
        else if (j == 0)
            focusTableCell(i-1, data.variables.length-1, 'uncertainty');
        else
            focusTableCell(i, j-1, 'uncertainty');
    }
    const moveRight = () => {
        if (specifier == 'variable') {
            focusTableCell(i, j, 'uncertainty');
        }
        else if (j == data.variables.length-1) {
            focusTableCell(i+1, 0, 'variable');
        }
        else {
            focusTableCell(i, j+1, 'variable');
        }
    }
    cell.onfocus = (e) => {
        inputHappendInFocusedCell = false;
        storedFocusesCellValue = cell.innerText;
        var sel, range;
        window.setTimeout(function() {
        if (window.getSelection && document.createRange) {
            range = document.createRange();
            range.selectNodeContents(cell);
            sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if ((<any> document.body).createTextRange) {
            range = (<any> document.body).createTextRange();
            range.moveToElementText(cell);
            range.select();
        }}, 1);
    }
    cell.onkeyup = (e) => { e.stopPropagation(); }
    cell.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            if (!inputHappendInFocusedCell)
                cell.innerText = storedFocusesCellValue;
            moveDown();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.stopPropagation();
            if (!inputHappendInFocusedCell)
                cell.innerText = storedFocusesCellValue;
            moveDown();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.stopPropagation();
            if (!inputHappendInFocusedCell)
                cell.innerText = storedFocusesCellValue;
            moveUp();
            return;
        }
        inputHappendInFocusedCell = true;
        if (e.key === 'ArrowRight') {
            let _range = document.getSelection().getRangeAt(0)
            let range = _range.cloneRange()
            range.selectNodeContents(cell)
            range.setEnd(_range.endContainer, _range.endOffset)
            const carretPosition = range.toString().length;
            if (carretPosition == cell.textContent.length) {
                moveRight();
            }
            return;
        }
        if (e.key === 'ArrowLeft') {
            let _range = document.getSelection().getRangeAt(0)
            let range = _range.cloneRange()
            range.selectNodeContents(cell)
            range.setEnd(_range.endContainer, _range.endOffset)
            const carretPosition = range.toString().length;
            if (carretPosition == 0) {
                moveLeft();
            }
            return;
        }
    }
}

function keep_digits(n: number, x: number, other?: number) {
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
    // Calculer les moyennes des x et des y (pour le r)
    const xm = x.reduce((xx, p) => Number(xx) + p, 0) / x.length;
    const ym = y.reduce((yy, p) => Number(yy) + p, 0) / x.length;
    // Calculer les sommes permettant d'évaluer...
    let S11 = 0, Sx2 = 0, Sy2 = 0, Sxy = 0, Sx1 = 0, Sy1 = 0;  // ... a, b, ua, ub
    let SDxy = 0, SDx2 = 0, SDy2 = 0;  // ... r
    for (let i = 0; i < x.length; i++) {
        const w = u[i] == 0 ? Number.MIN_VALUE : 1 / Math.pow(u[i], 2);
        S11 += w;
        Sx1 += w * x[i];
        Sy1 += w * y[i];
        Sxy += w * x[i] * y[i];
        Sx2 += w * Math.pow(x[i], 2);
        Sy2 += w * Math.pow(y[i], 2);
        SDxy += (x[i] - xm) * (y[i] - ym);
        SDx2 += Math.pow(x[i] - xm, 2);
        SDy2 += Math.pow(y[i] - ym, 2);
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


function redraw(): void {

    const modal = document.getElementById("modal");
    modal.onclick = (e) => { if (e.target == modal) modal.classList.remove("modal-visible"); };

    const table = document.getElementById('data-table');

    const row = <HTMLTableRowElement> getOrCreateElementWithId('tr', 'header-row', table);
    const settingsRow = <HTMLTableRowElement> getOrCreateElementWithId('tr', 'settings-row', table);
    for (let j = 0; j < data.variables.length; j++) {
        const i = -1;
        addCellToRow(data.variables[j], i, j, 'variable', row, (e, s) => {
            data.variables[j] = s;
        });
        addCellToRow('u(' + data.variables[j] + ')', i, j, 'uncertainty', row, () => {});

        const settingsCell = <HTMLTableCellElement> getOrCreateElementWithId('td', tableCellId(i, j, 'settings'), settingsRow);
        settingsCell.colSpan = 2;
        settingsCell.onclick = () => {
            const modalTitle = document.getElementById("modal-title");
            modalTitle.textContent = "Paramètres de " + data.variables[j];
            const modalContent = document.getElementById("modal-content");
            modalContent.innerHTML = `
            <fieldset>
                <legend>Incertitudes</legend>
                <input type="checkbox" id="uncertainty-` + j + `-display" ` + (data.show_uncertainties[j] ? `checked` : ``) + `/><label for="uncertainty-` + j + `-display">Afficher</label>
                <input type="checkbox" id="uncertainty-` + j + `-use" ` + (data.use_uncertainties[j] ? `checked` : ``) + `/><label for="uncertainty-` + j + `-use">Utiliser</label>
            </fieldset>
            `;
            document.getElementById("modal").classList.add("modal-visible");
            document.getElementById("uncertainty-" + j + "-display").onclick = () => {
                data.show_uncertainties[j] = (<HTMLFormElement> document.getElementById("uncertainty-" + j + "-display")).checked;
                redraw();
            }
            document.getElementById("uncertainty-" + j + "-use").onclick = () => {
                data.use_uncertainties[j] = (<HTMLFormElement> document.getElementById("uncertainty-" + j + "-use")).checked;
                redraw();
            }
        }
    }

    for (let i = 0; i < data.values.length; i++) {
        const row = <HTMLTableRowElement> getOrCreateElementWithId('tr', 'row-' + i, table);
        row.classList.add('data-row');
        for (let j = 0; j < data.variables.length; j++) {
            addCellToRow(data.values[i][j], i, j, 'variable', row, (e, s) => {
                data.values[i][j] = s;
            });
            addCellToRow(data.uncertainties[i][j], i, j, 'uncertainty', row, (e, s) => {
                data.uncertainties[i][j] = s;
            });
        }
    }

    const lastRow = <HTMLTableRowElement> getOrCreateElementWithId('tr', 'row-' + data.values.length, table);
    for (let j = 0; j < data.variables.length; j++) {
        const i = data.values.length;
        addCellToRow('', i, j, 'variable', lastRow, (e, s) => {
            if (!s) return;
            if (!data.values[i])
                data.values.push(Array(data.variables.length).fill(""));
            if (!data.uncertainties[i])
                data.uncertainties.push(Array(data.variables.length).fill(""));
            data.values[i][j] = s;
        });
        addCellToRow('', i, j, 'uncertainty', lastRow, (e, s) => {
            if (!s) return;
            if (!data.values[i])
                data.values.push(Array(data.variables.length).fill(""));
            if (!data.uncertainties[i])
                data.uncertainties.push(Array(data.variables.length).fill(""));
            data.uncertainties[i][j] = s;
        });
    }

    let valid_data: Data = {variables: [], values: [], uncertainties: [], show_uncertainties: [], use_uncertainties: []};
    valid_data.variables.push(...data.variables);
    for (let i = 0; i < data.values.length; i++) {
        const xy = data.values[i];
        const uxy = data.uncertainties.map((u, j) => data.use_uncertainties[j] ? u[j] : "0");
        let isBad = false;
        for (let j = 0; j < data.variables.length; j++) {
            const vIsBad = (xy[j] == undefined) || (xy[j].length == 0) || !Number.isFinite(Number(xy[j]));
            const uIsBad = (uxy[j] == undefined) || (uxy[j].length == 0) || !Number.isFinite(Number(uxy[j]));
            const vCell = document.getElementById("data-row-" + i + "-variable-" + j);
            const uCell = document.getElementById("data-row-" + i + "-uncertainty-" + j);
            if (vIsBad || uIsBad) {
                vCell.classList.add("data-cell-nan");
                uCell.classList.add("data-cell-nan");
            } else {
                vCell.classList.remove("data-cell-nan");
                uCell.classList.remove("data-cell-nan");
            }
            isBad = isBad || vIsBad || uIsBad;
        }
        if (!isBad) {
            valid_data.values.push(xy);
            valid_data.uncertainties.push(uxy);
        }
    }

    const regres = regress(
        valid_data.values.map(xy => Number(xy[0])),
        valid_data.values.map(xy => Number(xy[1])),
        valid_data.uncertainties.map(uxy => Number(uxy[1]))
    );

    setClassContentTo("eqn-abscisse", data.variables[0]);
    setClassContentTo("eqn-ordinate", data.variables[1]);
    setClassContentTo("eqn-intercept-value", keep_digits(3, regres.sigma_a, regres.a));
    setClassContentTo("eqn-intercept-uncertainty", keep_digits(3, regres.sigma_a));
    setClassContentTo("eqn-slope-value", keep_digits(3, regres.sigma_b, regres.b));
    setClassContentTo("eqn-slope-uncertainty", keep_digits(3, regres.sigma_b));
    setClassContentTo("eqn-r-value", keep_digits(2, 1-regres.r, regres.r));
    setClassContentTo("eqn-r2-value", keep_digits(2, 1-regres.r, Math.pow(regres.r, 2)));
    setClassContentTo("eqn-sigmastat-value", keep_digits(3, regres.sigma_stat));
    setClassContentTo("eqn-chi2-value", keep_digits(3, regres.chi2));
    setClassContentTo("eqn-chi2red-value", keep_digits(3, regres.chi2red));

    const chart = document.getElementById("chart");
    var svgns = "http://www.w3.org/2000/svg";
    const svg = chart.getElementsByTagName("svg")[0];
    svg.innerHTML = "";
    const w = svg.getBoundingClientRect().width;
    const h = svg.getBoundingClientRect().height;
    const xmax0 = Math.max(...data.values.flatMap((v) => Number(v[0])).filter((n) => Number.isFinite(n)));
    const xmin0 = Math.min(...data.values.flatMap((v) => Number(v[0])).filter((n) => Number.isFinite(n)));
    console.log(xmin0);
    const ymax0 = Math.max(...data.values.flatMap((v) => Number(v[1])).filter((n) => Number.isFinite(n)));
    const ymin0 = Math.min(...data.values.flatMap((v) => Number(v[1])).filter((n) => Number.isFinite(n)));
    const xmin = xmin0 - 0.05 * (xmax0 - xmin0);
    console.log(xmin);
    const xmax = xmax0 + 0.05 * (xmax0 - xmin0);
    const ymin = ymin0 - 0.05 * (ymax0 - ymin0);
    const ymax = ymax0 + 0.05 * (ymax0 - ymin0);

    function dataToPixel(x: number, y: number): number[] {
        const X = (x - xmin) / (xmax - xmin) * (w - 55) + 50;
        const Y = h - (y - ymin) / (ymax - ymin) * (h - 25) - 20;
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
        drawLine(x-uxsize, y, x+uxsize, y, c);
        drawLine(x, y-uysize, x, y+uysize, c);
        if (uxsize == ux) {
            drawLine(x-uxsize, y-barsize[1], x-uxsize, y+barsize[1], c);
            drawLine(x+uxsize, y-barsize[1], x+uxsize, y+barsize[1], c);
        }
        if (uysize == uy) {
            drawLine(x-barsize[0], y-uysize, x+barsize[0], y-uysize, c);
            drawLine(x-barsize[0], y+uysize, x+barsize[0], y+uysize, c);
        }
    }

    function drawXAxisPoint(x: number, y: number, c: string): void {
        const barsize = pixelToData(6, 6)[1];
        drawLine(x, y-barsize, x, y, c);
        drawText(x, y-barsize, x.toString(), 'middle', 'hanging');
    }

    function drawYAxisPoint(x: number, y: number, c: string): void {
        const barsize = pixelToData(6, 6)[0];
        drawLine(x-barsize, y, x, y, c);
        drawText(x-barsize, y, y.toString(), 'end', 'central');
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

    const xRange = xmax - xmin;
    let xsep = xRange / 5;
    let xsepOptions = [1, 2, 5].map(x => x * Math.pow(10, Math.floor(Math.log10(xsep))));
    xsep = xsepOptions.sort((a, b) => Math.abs(a - xsep) - Math.abs(b - xsep))[0];
    for (let i = Math.floor(xmin / xsep); i <= Math.ceil(xmax / xsep); i++) {
        const xline = i * xsep;
        for (let j = 1; j < 5; j++) {
            const xline2 = xline + j * xsep / 5;
            if (xline2 <= xmin) continue;
            drawLine(xline2, ymin, xline2, ymax, 'lightgray');
        }
        if (xline < xmin) continue;
        drawLine(xline, ymin, xline, ymax, 'gray');
        drawXAxisPoint(xline, ymin, 'black');
    }
    const yRange = ymax - ymin;
    let ysep = yRange / 5;
    let ysepOptions = [1, 2, 5].map(y => y * Math.pow(10, Math.floor(Math.log10(ysep))));
    ysep = ysepOptions.sort((a, b) => Math.abs(a - ysep) - Math.abs(b - ysep))[0];
    for (let i = Math.floor(xmin / xsep); i <= Math.ceil(ymax / ysep); i++) {
        const yline = i * ysep;
        for (let j = 1; j < 5; j++) {
            const yline2 = yline + j * ysep / 5;
            if (yline2 <= ymin) continue;
            drawLine(xmin, yline2, xmax, yline2, 'lightgray');
        }
        if (yline < ymin) continue;
        drawLine(xmin, yline, xmax, yline, 'gray');
        drawYAxisPoint(xmin, yline, 'black');
    }
    drawLine(xmin, ymin, xmax, ymin, 'black');
    drawLine(xmin, ymin, xmin, ymax, 'black');
    drawLine(xmin, ymax, xmax, ymax, 'black');
    drawLine(xmax, ymin, xmax, ymax, 'black');

    for (let i = 0; i < valid_data.values.length; i++) {
        const x = Number(valid_data.values[i][0]);
        const y = Number(valid_data.values[i][1]);
        const ux = Number(valid_data.uncertainties[i][0]);
        const uy = Number(valid_data.uncertainties[i][1]);
        drawDataPoint(x, y, ux, uy, 'blue');
    }
    drawLine(xmin, regres.a + regres.b * xmin, xmax, regres.a + regres.b * xmax, 'blue');

    // if (cellIdToFocus) {
    //     console.log(cellIdToFocus);
    //     const ce = document.getElementById(cellIdToFocus);
    //     const range = document.createRange();
    //     range.selectNodeContents(ce);
    //     range.collapse();
    //     const sel = document.getSelection();
    //     sel.removeAllRanges();
    //     sel.addRange(range);
    //     cellIdToFocus = undefined;
    // }
}

redraw();