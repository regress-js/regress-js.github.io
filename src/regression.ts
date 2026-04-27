export interface RegressionResult {
    b: number,
    a: number,
    sigma_b: number,
    sigma_a: number,
    sigma_stat: number,
    r: number,
    chi2: number,
    chi2red: number,
}

export function regress(x: number[], y: number[], uy: number[]): RegressionResult {
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