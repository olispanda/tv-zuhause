/* Top-down train glyphs as SDF images (nose points north), tinted per category via icon-color.
   Style "Stromlinie": slim cars, an aerodynamic tapered nose with a curved windscreen, rounded tail.
   'train-long' / 'train-short' are filled; '-tunnel' variants are outline only. */
window.TrainIcons = (function () {
  'use strict';
  var PR = 2;                      // pixelRatio of the images
  var W = 12 * PR, PAD = 3 * PR;   // car width and padding (SDF halo room)
  var NOSE = 9 * PR, GAP = 1.6 * PR, R = 1.5 * PR, TAIL = 4 * PR;

  /* One car outline. x/y = top-left of the car body, h = body height (the nose sits above y on the first car). */
  function carPath(g, x, y, w, h, nose, rTop, rBot) {
    g.beginPath();
    if (nose) {
      g.moveTo(x, y + h - rBot);
      g.lineTo(x, y);
      g.bezierCurveTo(x, y - nose * 0.55, x + w * 0.28, y - nose, x + w / 2, y - nose);
      g.bezierCurveTo(x + w * 0.72, y - nose, x + w, y - nose * 0.55, x + w, y);
    } else {
      g.moveTo(x, y + h - rBot);
      g.lineTo(x, y + rTop); g.quadraticCurveTo(x, y, x + rTop, y);
      g.lineTo(x + w - rTop, y); g.quadraticCurveTo(x + w, y, x + w, y + rTop);
    }
    g.lineTo(x + w, y + h - rBot); g.quadraticCurveTo(x + w, y + h, x + w - rBot, y + h);
    g.lineTo(x + rBot, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rBot);
    g.closePath();
  }

  /* cars: number of cars; carLen in css px; outline: stroke only. */
  function draw(cars, carLen, outline) {
    var L = carLen * PR, w = W + PAD * 2, h = NOSE + cars * L + (cars - 1) * GAP + PAD * 2;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2.4 * PR; g.lineJoin = 'round'; g.lineCap = 'round';
    for (var i = 0; i < cars; i++) {
      var y = PAD + NOSE + i * (L + GAP), first = i === 0, last = i === cars - 1, rBot = last ? TAIL : R;
      if (outline) {
        var o = g.lineWidth / 2;
        carPath(g, PAD + o, y + (first ? 0 : o), W - 2 * o, L - (first ? o : 2 * o), first ? NOSE - o : 0, Math.max(1, R - o), Math.max(1, rBot - o));
        g.stroke();
      } else {
        carPath(g, PAD, y, W, L, first ? NOSE : 0, R, rBot); g.fill();
        // curved windscreen on the leading car, so the direction reads at a glance
        if (first) {
          g.save(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 1.8 * PR;
          g.beginPath(); g.moveTo(PAD + W * 0.2, y - NOSE * 0.1); g.quadraticCurveTo(PAD + W / 2, y - NOSE * 0.5, PAD + W * 0.8, y - NOSE * 0.1); g.stroke();
          g.restore();
        }
      }
    }
    return g.getImageData(0, 0, w, h);
  }

  function add(map) {
    var opt = { sdf: true, pixelRatio: PR };
    map.addImage('train-long', draw(3, 17, false), opt);
    map.addImage('train-short', draw(2, 16, false), opt);
    map.addImage('train-long-tunnel', draw(3, 17, true), opt);
    map.addImage('train-short-tunnel', draw(2, 16, true), opt);
  }

  /* Small inline SVG glyph for a legend (horizontal, nose right). */
  function legend(color, outline) {
    var st = outline ? 'fill="none" stroke="' + color + '" stroke-width="1.4"' : 'fill="' + color + '"';
    return '<svg class="leg-train" viewBox="0 0 32 10" aria-hidden="true">' +
      '<path ' + st + ' d="M1 3Q1 1 3 1H13V9H3Q1 9 1 7Z"/>' +
      '<path ' + st + ' d="M14.5 1H25C28 1 31 3.6 31 5S28 9 25 9H14.5Z"/></svg>';
  }

  return { add: add, legend: legend };
})();
