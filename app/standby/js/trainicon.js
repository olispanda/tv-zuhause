/* Top-down train glyphs as SDF images (nose points north), tinted per category via icon-color.
   'train-long' / 'train-short' are filled; '-tunnel' variants are outline only. */
window.TrainIcons = (function () {
  'use strict';
  var PR = 2;                      // pixelRatio of the images
  var W = 16 * PR, PAD = 3 * PR;   // car width and padding (SDF halo room)

  function carPath(g, x, y, w, h, rTop, rBot) {
    g.beginPath();
    g.moveTo(x + rTop, y);
    g.lineTo(x + w - rTop, y); g.quadraticCurveTo(x + w, y, x + w, y + rTop);
    g.lineTo(x + w, y + h - rBot); g.quadraticCurveTo(x + w, y + h, x + w - rBot, y + h);
    g.lineTo(x + rBot, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rBot);
    g.lineTo(x, y + rTop); g.quadraticCurveTo(x, y, x + rTop, y);
    g.closePath();
  }

  /* cars: number of cars; carLen in css px; outline: stroke only. */
  function draw(cars, carLen, outline) {
    var L = carLen * PR, GAP = 2 * PR, w = W + PAD * 2, h = cars * L + (cars - 1) * GAP + PAD * 2;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2.6 * PR;
    for (var i = 0; i < cars; i++) {
      var y = PAD + i * (L + GAP), first = i === 0, last = i === cars - 1;
      var rTop = first ? W * 0.5 : 2.5 * PR, rBot = last ? W * 0.32 : 2.5 * PR;
      if (outline) { var o = g.lineWidth / 2; carPath(g, PAD + o, y + o, W - 2 * o, L - 2 * o, Math.max(1, rTop - o), Math.max(1, rBot - o)); g.stroke(); }
      else {
        carPath(g, PAD, y, W, L, rTop, rBot); g.fill();
        // windscreen on the leading car: cut a small band so the direction reads at a glance
        if (first) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(PAD + W * 0.22, y + W * 0.42, W * 0.56, 2 * PR); g.restore(); }
      }
    }
    return g.getImageData(0, 0, w, h);
  }

  function add(map) {
    var opt = { sdf: true, pixelRatio: PR };
    map.addImage('train-long', draw(3, 15, false), opt);
    map.addImage('train-short', draw(2, 14, false), opt);
    map.addImage('train-long-tunnel', draw(3, 15, true), opt);
    map.addImage('train-short-tunnel', draw(2, 14, true), opt);
  }

  /* Small inline SVG glyph for the legend (horizontal). */
  function legend(color, outline) {
    var st = outline ? 'fill="none" stroke="' + color + '" stroke-width="1.6"' : 'fill="' + color + '"';
    return '<svg class="leg-train" viewBox="0 0 30 12" aria-hidden="true">' +
      '<path ' + st + ' d="M1.5 3.5Q1.5 1.5 3.5 1.5H13V10.5H3.5Q1.5 10.5 1.5 8.5Z"/>' +
      '<path ' + st + ' d="M15 1.5H23Q28.5 1.5 28.5 6Q28.5 10.5 23 10.5H15Z"/></svg>';
  }

  return { add: add, legend: legend };
})();
