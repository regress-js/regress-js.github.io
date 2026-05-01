import { regress, RegressionResult } from "./regression";

var svgns = "http://www.w3.org/2000/svg";

export class ChartData {
    x: number[] = [];
    y: number[] = [];
    ux: number[] = [];
    uy: number[] = [];
}

interface PlotBounds {
    xmin: number, ymin: number, xmax: number, ymax: number,
    width: number, height: number,
}

function getBounds(svg: SVGSVGElement, chartData: ChartData) : PlotBounds {
    const dataXmax = Math.max(...chartData.x.map((x, i) => x + chartData.ux[i]));
    const dataXmin = Math.min(...chartData.x.map((x, i) => x - chartData.ux[i]));
    const dataYmax = Math.max(...chartData.y.map((y, i) => y + chartData.uy[i]));
    const dataYmin = Math.min(...chartData.y.map((y, i) => y - chartData.uy[i]));
    return {
        xmin: dataXmin - 0.05 * (dataXmax - dataXmin) - dataYmin/1000,
        xmax: dataXmax + 0.05 * (dataXmax - dataXmin) + dataXmax/1000,
        ymin: dataYmin - 0.05 * (dataYmax - dataYmin) - dataYmin/1000,
        ymax: dataYmax + 0.05 * (dataYmax - dataYmin) + dataYmax/1000,
        width: svg.getBoundingClientRect().width,
        height: svg.getBoundingClientRect().height
    }
}

function draw(svg: SVGSVGElement, ...elements: Element[]) {
    elements.forEach(e => svg.appendChild(e));
}

function dataToPixel(bounds: PlotBounds, x: number, y: number): number[] {
    const X = (x - bounds.xmin) / (bounds.xmax - bounds.xmin) * (bounds.width - 55) + 50;
    const Y = bounds.height - (y - bounds.ymin) / (bounds.ymax - bounds.ymin) * (bounds.height - 30) - 25;
    return [X, Y];
}

function pixelToData(bounds: PlotBounds, X: number, Y: number): number[] {
    const x = X / bounds.width * (bounds.xmax - bounds.xmin);
    const y = Y / bounds.height * (bounds.ymax - bounds.ymin);
    return [x, y];
}

function line(bounds: PlotBounds, x1: number, y1: number, x2: number, y2: number, c: string): Element[] {
    const [X1, Y1] = dataToPixel(bounds, x1, y1);
    const [X2, Y2] = dataToPixel(bounds, x2, y2);
    const line = document.createElementNS(svgns, 'line');
    line.setAttributeNS(null, 'x1', X1.toString());
    line.setAttributeNS(null, 'x2', X2.toString());
    line.setAttributeNS(null, 'y1', Y1.toString());
    line.setAttributeNS(null, 'y2', Y2.toString());
    line.setAttributeNS(null, 'stroke', c);
    return [line];
}

function drawText(bounds: PlotBounds, x: number, y: number, value: string, align: string, valign: string): Element[] {
    const [X, Y] = dataToPixel(bounds, x, y);
    const text = document.createElementNS(svgns, 'text');
    text.setAttributeNS(null, 'x', X.toString());
    text.setAttributeNS(null, 'y', Y.toString());
    text.setAttributeNS(null, 'text-anchor', align);
    text.setAttributeNS(null, 'dominant-baseline', valign);
    text.textContent = value;
    text.classList.add("xtick");
    return [text]
}

function dataPoint(bounds: PlotBounds, x: number, y: number, ux: number, uy: number, c: string): Element[] {
    const res: Element[] = [];
    const [xMinBarSize, yMinBarSize] = pixelToData(bounds, 3, 3);
    const xBarSize = Math.max(ux, xMinBarSize);
    const yBarSize = Math.max(uy, yMinBarSize);
    if (uy == 0) console.log(xBarSize, yBarSize);
    // main cross
    res.push(...line(bounds, Math.max(bounds.xmin, x-xBarSize), y, Math.min(bounds.xmax, x+xBarSize), y, c));
    res.push(...line(bounds, x, Math.max(bounds.ymin, y-yBarSize), x, Math.min(bounds.ymax, y+yBarSize), c));
    if (xBarSize == ux) {
        // vertical whiskers on cross's horizontal edge
        res.push(...line(bounds, x-xBarSize, y-yMinBarSize, x-xBarSize, y+yMinBarSize, c));
        res.push(...line(bounds, x+xBarSize, y-yMinBarSize, x+xBarSize, y+yMinBarSize, c));
    }
    if (yBarSize == uy) {
        // horizontal whiskers on cross's vertical edge
        res.push(...line(bounds, x-xMinBarSize, y-yBarSize, x+xMinBarSize, y-yBarSize, c));
        res.push(...line(bounds, x-xMinBarSize, y+yBarSize, x+xMinBarSize, y+yBarSize, c));
    }
    return res;
}

function xTick(bounds: PlotBounds, x: number, y: number, c: string): Element[] {
    const res: Element[] = [];
    const barsize = pixelToData(bounds, 6, 6)[1];
    res.push(...line(bounds, x, y-barsize, x, y, c));
    res.push(...drawText(bounds, x, y-barsize*2, x.toString(), 'middle', 'hanging'));
    return res;
}

function yTick(bounds: PlotBounds, x: number, y: number, c: string): Element[] {
    const res: Element[] = [];
    const barsize = pixelToData(bounds, 6, 6)[0];
    res.push(...line(bounds, x-barsize, y, x, y, c));
    res.push(...drawText(bounds, x-barsize*2, y, y.toString(), 'end', 'central'));
    return res;
}

function dot(bounds: PlotBounds, x: number, y: number, s: number, c: string): Element[] {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Number.isNaN(x) || Number.isNaN(y))
        return [];
    const [X, Y] = dataToPixel(bounds, x, y);
    const dot = document.createElementNS(svgns, 'circle');
    dot.setAttributeNS(null, 'cx', X.toString());
    dot.setAttributeNS(null, 'cy', Y.toString());
    dot.setAttributeNS(null, 'r', s.toString());
    dot.setAttributeNS(null, 'fill', c);
    return [dot];
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

export function updateChart(svg: SVGSVGElement, chartData: ChartData, regres: RegressionResult) {

    svg.setAttribute("height", `${(svg.clientWidth - 50)/1.618 + 20}px`);
    svg.innerHTML = "";
    const bounds = getBounds(svg, chartData);

    const [xTicks, xSubticks] = divideRange(bounds.xmin, bounds.xmax, 5);
    const [yTicks, ySubticks] = divideRange(bounds.ymin, bounds.ymax, 5);
    // gridlines
    draw(svg, ...xSubticks.flatMap(x => line(bounds, x, bounds.ymin, x, bounds.ymax, "lightgray")));
    draw(svg, ...ySubticks.flatMap(y => line(bounds, bounds.xmin, y, bounds.xmax, y, "lightgray")));
    draw(svg, ...xTicks.flatMap(x => line(bounds, x, bounds.ymin, x, bounds.ymax, "gray")));
    draw(svg, ...yTicks.flatMap(y => line(bounds, bounds.xmin, y, bounds.xmax, y, "gray")));
    // ticks
    draw(svg, ...xTicks.flatMap(x => xTick(bounds, x, bounds.ymin, "black")));
    draw(svg, ...yTicks.flatMap(y => yTick(bounds, bounds.xmin, y, "black")));
    // axes
    draw(svg, ...line(bounds, bounds.xmin, bounds.ymin, bounds.xmax, bounds.ymin, 'black'));
    draw(svg, ...line(bounds, bounds.xmin, bounds.ymin, bounds.xmin, bounds.ymax, 'black'));
    draw(svg, ...line(bounds, bounds.xmin, bounds.ymax, bounds.xmax, bounds.ymax, 'black'));
    draw(svg, ...line(bounds, bounds.xmax, bounds.ymin, bounds.xmax, bounds.ymax, 'black'));

    for (let j = 0; j < chartData.x.length; j++) {
        draw(svg, ...dataPoint(bounds, chartData.x[j], chartData.y[j], chartData.ux[j], chartData.uy[j], 'blue'));
    }

    let xStart = bounds.xmin;
    let yStart = regres.a + regres.b * xStart;
    if (yStart < bounds.ymin) {
        yStart = bounds.ymin;
        xStart = (yStart - regres.a) / regres.b;
    } else if (yStart > bounds.ymax) {
        yStart = bounds.ymax;
        xStart = (yStart - regres.a) / regres.b;
    }

    let xEnd = bounds.xmax;
    let yEnd = regres.a + regres.b * xEnd;
    if (yEnd < bounds.ymin) {
        yEnd = bounds.ymin;
        xEnd = (yEnd - regres.a) / regres.b;
    } else if (yEnd > bounds.ymax) {
        yEnd = bounds.ymax;
        xEnd = (yEnd - regres.a) / regres.b;
    }

    draw(svg, ...line(bounds, xStart, yStart, xEnd, yEnd, 'blue'));
}