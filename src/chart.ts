import { RegressionResult } from "./regression";

export class ChartData {
    x: number[] = [];
    y: number[] = [];
    ux: number[] = [];
    uy: number[] = [];
}

export function updateChart(svg: SVGSVGElement, chartData: ChartData, regres: RegressionResult) {

    var svgns = "http://www.w3.org/2000/svg";
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

    for (let j = 0; j < chartData.x.length; j++) {
        drawDataPoint(chartData.x[j], chartData.y[j], chartData.ux[j], chartData.uy[j], 'blue');
    }
    drawLine(xmin, regres.a + regres.b * xmin, xmax, regres.a + regres.b * xmax, 'blue');
}