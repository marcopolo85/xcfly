/** Pure helpers for the "XC Relief" map style (hypsometric tint + peak labels). */

// [elevation m, r, g, b] – meadow green → ochre/brown → slate grey → snow white
const RAMP: [number, number, number, number][] = [
  [200, 110, 160, 90], [600, 120, 168, 92], [900, 168, 170, 100], [1300, 190, 158, 98],
  [1700, 166, 128, 88], [2200, 146, 134, 124], [2700, 190, 188, 184], [3300, 236, 236, 234], [4800, 252, 252, 252],
];
/** 1-m lookup table built once; hot pixel loops only index into it. */
export const HYPSO_LUT = (() => {
  const lut = new Uint8ClampedArray(5000 * 3);
  for (let h = 0; h < 5000; h++) {
    let i = 0;
    while (i < RAMP.length - 2 && h > RAMP[i + 1][0]) i++;
    const a = RAMP[i], b = RAMP[i + 1];
    const t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])));
    lut[h * 3] = a[1] + (b[1] - a[1]) * t;
    lut[h * 3 + 1] = a[2] + (b[2] - a[2]) * t;
    lut[h * 3 + 2] = a[3] + (b[3] - a[3]) * t;
  }
  return lut;
})();

export function hypsoColor(h: number): [number, number, number] {
  const i = Math.min(4999, Math.max(0, Math.round(h))) * 3;
  return [HYPSO_LUT[i], HYPSO_LUT[i + 1], HYPSO_LUT[i + 2]];
}

/** Recolour Terrarium-encoded RGBA pixels in place with the hypsometric ramp. */
export function tintTerrarium(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const h = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    const k = (h < 0 ? 0 : h > 4999 ? 4999 : h | 0) * 3;
    data[i] = HYPSO_LUT[k]; data[i + 1] = HYPSO_LUT[k + 1]; data[i + 2] = HYPSO_LUT[k + 2]; data[i + 3] = 255;
  }
}

/** Prominent Swiss summits: [name, lat, lon, height m, minimum tile level to show]. */
export const PEAKS: [string, number, number, number, number][] = [
  ["Dufourspitze", 45.9369, 7.8668, 4634, 9], ["Dom", 46.0939, 7.8586, 4545, 10], ["Weisshorn", 46.1014, 7.7161, 4506, 10],
  ["Matterhorn", 45.9763, 7.6586, 4478, 9], ["Finsteraarhorn", 46.5372, 8.1261, 4274, 9], ["Jungfrau", 46.5367, 7.9625, 4158, 9],
  ["Eiger", 46.5775, 8.0053, 3967, 10], ["Mönch", 46.5586, 7.9975, 4107, 11], ["Piz Bernina", 46.3826, 9.9081, 4049, 9],
  ["Grand Combin", 45.9375, 7.2994, 4314, 10], ["Dents du Midi", 46.1617, 6.9228, 3257, 11], ["Wildstrubel", 46.4003, 7.5281, 3244, 11],
  ["Blüemlisalp", 46.4889, 7.7697, 3661, 11], ["Schreckhorn", 46.5897, 8.1181, 4078, 11], ["Titlis", 46.7722, 8.4375, 3238, 10],
  ["Dammastock", 46.6436, 8.4208, 3630, 11], ["Tödi", 46.8111, 8.9150, 3614, 10], ["Glärnisch", 46.9986, 8.9986, 2914, 11],
  ["Säntis", 47.2494, 9.3433, 2502, 10], ["Altmann", 47.2367, 9.3628, 2436, 12], ["Churfirsten", 47.1617, 9.2981, 2306, 12],
  ["Pilatus", 46.9789, 8.2539, 2128, 10], ["Rigi Kulm", 47.0564, 8.4853, 1797, 10], ["Stanserhorn", 46.9294, 8.3403, 1898, 11],
  ["Brienzer Rothorn", 46.7869, 8.0469, 2350, 11], ["Niesen", 46.6458, 7.6514, 2362, 11], ["Stockhorn", 46.6947, 7.5422, 2190, 11],
  ["Gummen", 46.9031, 8.3664, 2003, 12], ["Brisen", 46.8869, 8.4644, 2404, 12], ["Uri Rotstock", 46.8611, 8.5361, 2928, 11],
  ["Grosser Mythen", 47.0294, 8.6853, 1899, 11], ["Fronalpstock", 46.9681, 8.6378, 1922, 12], ["Gross Windgällen", 46.8203, 8.7300, 3187, 11],
  ["Oberalpstock", 46.7342, 8.7869, 3328, 11], ["Piz Kesch", 46.6211, 9.8722, 3418, 10], ["Piz Linard", 46.7983, 10.0711, 3410, 11],
  ["Ringelspitz", 46.8956, 9.3406, 3247, 11], ["Calanda", 46.8933, 9.4694, 2806, 11], ["Weissfluh", 46.8336, 9.8058, 2843, 11],
  ["Rheinwaldhorn", 46.4939, 9.0389, 3402, 10], ["Monte Generoso", 45.9275, 9.0194, 1701, 11], ["Monte Tamaro", 46.1053, 8.8536, 1962, 11],
  ["Pizzo Centrale", 46.5847, 8.6097, 2999, 12], ["Chasseral", 47.1328, 7.0583, 1606, 10], ["Weissenstein", 47.2486, 7.5103, 1395, 11],
  ["Napf", 47.0050, 7.9406, 1408, 11], ["Hohgant", 46.7894, 7.8961, 2197, 12], ["Schilthorn", 46.5583, 7.8353, 2970, 11],
  ["Moléson", 46.5492, 7.0175, 2002, 11], ["Vanil Noir", 46.5361, 7.1592, 2389, 12], ["Diablerets", 46.3050, 7.1903, 3210, 11],
];
