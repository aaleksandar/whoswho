// WhosWho · 3D spirit animals: modelled chibi characters that hop, blink and wiggle.
(function () {
  var Z3 = window.WWZoo3D = {};
  var INK = '#2A1E16';

  Z3.env = function (T, renderer) {
    var s = new T.Scene();
    var g = new T.SphereGeometry(10, 32, 16), cols = [], p = g.attributes.position, c = new T.Color();
    for (var i = 0; i < p.count; i++) { var y = p.getY(i) / 10; c.set(y > 0.2 ? 0xFFF8EC : y > -0.1 ? 0xF6D9B8 : 0xB89A74); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    s.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    var panel = new T.Mesh(new T.PlaneGeometry(6, 3), new T.MeshBasicMaterial({ color: 0xFFFFFF }));
    panel.position.set(-4, 6, 5); panel.lookAt(0, 0, 0); s.add(panel);
    var pm = new T.PMREMGenerator(renderer);
    var tex = pm.fromScene(s, 0.03).texture; pm.dispose();
    return tex;
  };

  Z3.build = function (T, kind, env) {
    var cache = {};
    var M = function (c, gloss) {
      var k = c + (gloss ? 'g' : '');
      if (!cache[k]) {
        cache[k] = new T.MeshPhysicalMaterial({ color: new T.Color(c), roughness: gloss ? 0.12 : 0.55, clearcoat: gloss ? 1 : 0.4, clearcoatRoughness: 0.35 });
        if (env) { cache[k].envMap = env; cache[k].envMapIntensity = gloss ? 0.9 : 0.25; }
      }
      return cache[k];
    };
    var SG = Z3._sg || (Z3._sg = new T.SphereGeometry(1, 28, 20));
    var root = new T.Group(), ch = new T.Group(); ch.position.y = 0.95; root.add(ch);
    var head = new T.Group(); ch.add(head);
    var parts = { eyes: [], ears: [], tail: null };
    var R = 0.5;
    var fz = function (x, y) { return Math.sqrt(Math.max(0, R * R - x * x - y * y)); };
    var mesh = function (geo, c, gloss) { var m = new T.Mesh(geo, M(c, gloss)); m.castShadow = true; m.receiveShadow = true; return m; };
    var sph = function (par, c, x, y, z, sx, sy, sz, gloss) { var m = mesh(SG, c, gloss); m.position.set(x, y, z); m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); par.add(m); return m; };
    var stick = function (c, x, y, sx, sy, sz, rz, rad) {
      var r = rad || R, z = Math.sqrt(Math.max(0, r * r - x * x - y * y));
      var m = mesh(SG, c); m.position.set(x, y, z * 0.98); m.scale.set(sx, sy, sz); m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(x, y, z).normalize()); m.rotateZ(rz || 0); head.add(m); return m;
    };
    var cone = function (par, c, r, h, x, y, z, rx, rz, seg) { var m = mesh(new T.ConeGeometry(r, h, seg || 24), c); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); par.add(m); return m; };
    var eye = function (x, y, r, zo, white) {
      var g = new T.Group(); g.position.set(x, y, zo != null ? zo : fz(x, y) * 0.95);
      if (white) sph(g, '#FFFFFF', 0, 0, 0, r * 1.7, r * 1.7, r * 0.7);
      sph(g, INK, 0, 0, white ? r * 0.45 : 0, r, r * 1.08, r * 0.7, true);
      sph(g, '#FFFFFF', r * 0.35, r * 0.4, (white ? r * 0.45 : 0) + r * 0.6, r * 0.3);
      head.add(g); parts.eyes.push(g); return g;
    };
    var eyes = function (x, y, r, zo, white) { eye(-x, y, r, zo, white); eye(x, y, r, zo, white); };
    var cheeks = function (x, y, rad) { [-1, 1].forEach(function (m) { stick('#FF8FA8', m * x, y, 0.075, 0.05, 0.018, 0, rad); }); };
    var earCone = function (c, inner, x, y, r, h, tilt, fwd) {
      [-1, 1].forEach(function (m) {
        var g = new T.Group(); g.position.set(m * x, y, 0); g.rotation.z = -m * tilt; g.rotation.x = fwd || 0;
        cone(g, c, r, h, 0, h / 2, 0);
        if (inner) cone(g, inner, r * 0.55, h * 0.7, 0, h * 0.4, r * 0.38);
        head.add(g); parts.ears.push(g);
      });
    };
    var earRound = function (c, inner, x, y, r, z, ry) {
      [-1, 1].forEach(function (m) {
        var g = new T.Group(); g.position.set(m * x, y, z || 0); g.rotation.y = (ry || 0) * m;
        sph(g, c, 0, 0, 0, r, r, r * 0.55);
        if (inner) sph(g, inner, 0, 0, r * 0.32, r * 0.6, r * 0.6, r * 0.3);
        head.add(g); parts.ears.push(g);
      });
    };
    var nose = function (c, y, z, r, gl) { return sph(head, c, 0, y, z, r * 1.25, r * 0.9, r * 0.8, gl !== false); };
    var smile = function (y, z, r, c) { var m = mesh(new T.TorusGeometry(r, 0.016, 8, 24, Math.PI), c || INK); m.rotation.z = Math.PI; m.position.set(0, y, z); head.add(m); return m; };
    var whiskers = function (y, z) { [-1, 1].forEach(function (m) { [-0.06, 0.03].forEach(function (dy, k) { var w = mesh(new T.CylinderGeometry(0.006, 0.006, 0.28, 4), INK); w.rotation.z = Math.PI / 2 + m * (k ? 0.15 : -0.1); w.position.set(m * 0.3, y + dy, z); head.add(w); }); }); };
    var body = function (c, belly, w) {
      var b = sph(ch, c, 0, -0.62, -0.02, 0.33 * (w || 1), 0.3, 0.3);
      if (belly) sph(ch, belly, 0, -0.64, 0.1, 0.24 * (w || 1), 0.22, 0.22);
      [-1, 1].forEach(function (m) { sph(ch, c, m * 0.16, -0.9, 0.06, 0.1, 0.06, 0.12); sph(ch, c, m * 0.3, -0.6, 0.04, 0.08, 0.13, 0.08); });
      return b;
    };
    var H = function (c, sx, sy, sz) { return sph(head, c, 0, 0, 0, R * (sx || 1), R * (sy || 1), R * (sz || 1)); };
    var dirs = function (n, filter) { var out = [], ga = Math.PI * (3 - Math.sqrt(5)); for (var k = 0; k < n; k++) { var y = 1 - 2 * (k + 0.5) / n, rr = Math.sqrt(1 - y * y), a = k * ga, d = new T.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); if (!filter || filter(d)) out.push(d); } return out; };

    switch (kind) {
      case 'fox':
        body('#FF7A3D', '#FFF6EC'); H('#FF7A3D'); earCone('#FF7A3D', '#3A2320', 0.27, 0.32, 0.14, 0.32, 0.3);
        [-1, 1].forEach(function (m) { sph(head, '#FFF6EC', m * 0.19, -0.14, 0.3, 0.17, 0.14, 0.12); });
        sph(head, '#FFF6EC', 0, -0.13, 0.36, 0.17, 0.13, 0.2); nose(INK, -0.08, 0.56, 0.05); eyes(0.17, 0.07, 0.065);
        parts.tail = sph(ch, '#FF7A3D', 0, -0.62, -0.38, 0.12, 0.12, 0.26); sph(parts.tail, '#FFF6EC', 0, 0, -0.8, 0.7); break;
      case 'cat':
        body('#8E9AB4', '#FFFFFF'); H('#8E9AB4'); earCone('#8E9AB4', '#FFB3C7', 0.26, 0.33, 0.13, 0.26, 0.25);
        [[-0.09, 0.32], [0, 0.35], [0.09, 0.32]].forEach(function (p) { stick('#8A8DA0', p[0], p[1], 0.022, 0.07, 0.015); });
        sph(head, '#FFFFFF', 0, -0.15, 0.36, 0.15, 0.1, 0.12); nose('#FF6F91', -0.08, 0.48, 0.035); whiskers(-0.12, 0.42); eyes(0.17, 0.06, 0.065); cheeks(0.27, -0.1);
        parts.tail = sph(ch, '#8E9AB4', 0.1, -0.5, -0.36, 0.06, 0.24, 0.06); break;
      case 'bear':
        body('#A86B45', '#E7C9A6'); H('#A86B45'); earRound('#A86B45', '#E7B98F', 0.33, 0.33, 0.15);
        sph(head, '#E7C9A6', 0, -0.14, 0.34, 0.2, 0.15, 0.14); nose(INK, -0.08, 0.47, 0.055); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08); break;
      case 'rabbit':
        body('#F1E6FF', '#FFFFFF'); H('#F1E6FF');
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.16, 0.36, 0); g.rotation.z = -m * 0.12; sph(g, '#F1E6FF', 0, 0.3, 0, 0.1, 0.32, 0.07); sph(g, '#FFB3C7', 0, 0.3, 0.045, 0.055, 0.24, 0.035); head.add(g); parts.ears.push(g); });
        sph(head, '#FFFFFF', 0, -0.14, 0.36, 0.15, 0.1, 0.12); nose('#FF6F91', -0.09, 0.48, 0.035); var tt = mesh(new T.BoxGeometry(0.07, 0.07, 0.02), '#FFFFFF'); tt.position.set(0, -0.23, 0.44); head.add(tt);
        eyes(0.17, 0.06, 0.065); cheeks(0.28, -0.1); parts.tail = sph(ch, '#FFFFFF', 0, -0.68, -0.34, 0.1); break;
      case 'frog':
        body('#62C370', '#C9F2C0'); H('#62C370', 1.15, 0.85, 1);
        [-1, 1].forEach(function (m) { sph(head, '#62C370', m * 0.22, 0.3, 0.1, 0.16); });
        eye(-0.22, 0.32, 0.06, 0.25, true); eye(0.22, 0.32, 0.06, 0.25, true);
        smile(-0.02, 0.42, 0.2); cheeks(0.36, -0.08, 0.52); break;
      case 'panda':
        body(INK, '#FAFAFA'); H('#FAFAFA'); earRound(INK, null, 0.33, 0.34, 0.14);
        [-1, 1].forEach(function (m) { stick(INK, m * 0.16, 0.03, 0.1, 0.13, 0.04, m * 0.5); });
        eye(-0.16, 0.05, 0.035, 0.49); eye(0.16, 0.05, 0.035, 0.49); sph(head, '#FFFFFF', 0, -0.15, 0.36, 0.14, 0.1, 0.12); nose(INK, -0.1, 0.47, 0.045); break;
      case 'owl':
        body('#9A6B4A', '#D8B48A'); H('#9A6B4A', 1, 1.05, 1); sph(head, '#D8B48A', 0, -0.02, 0.22, 0.4, 0.4, 0.3);
        [-1, 1].forEach(function (m) { var d = mesh(new T.CylinderGeometry(0.15, 0.15, 0.04, 32), '#FFB020'); d.rotation.x = Math.PI / 2; d.position.set(m * 0.15, 0.04, 0.49); head.add(d); });
        eye(-0.15, 0.04, 0.07, 0.52, true); eye(0.15, 0.04, 0.07, 0.52, true);
        cone(head, '#FFB020', 0.05, 0.14, 0, -0.14, 0.52, Math.PI * 0.8); earCone('#6E4A33', null, 0.3, 0.38, 0.07, 0.2, 0.45); break;
      case 'pig':
        body('#FF9FB8', '#FFC2D2'); H('#FF9FB8'); earCone('#FF9FB8', '#FF7FA0', 0.3, 0.3, 0.13, 0.22, 0.55, 0.6);
        var sn = mesh(new T.CylinderGeometry(0.14, 0.15, 0.12, 28), '#FF7FA0'); sn.rotation.x = Math.PI / 2; sn.position.set(0, -0.1, 0.46); head.add(sn);
        [-1, 1].forEach(function (m) { sph(head, INK, m * 0.05, -0.1, 0.52, 0.025, 0.04, 0.02); }); eyes(0.18, 0.12, 0.05); cheeks(0.3, -0.06);
        parts.tail = mesh(new T.TorusGeometry(0.05, 0.015, 8, 16), '#FF9FB8'); parts.tail.position.set(0, -0.55, -0.32); ch.add(parts.tail); break;
      case 'lion':
        body('#F5B94E', '#FFF1D6'); sph(head, '#C8742E', 0, 0, -0.12, 0.62, 0.62, 0.4);
        for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2; sph(head, '#C8742E', Math.cos(a) * 0.52, Math.sin(a) * 0.52, -0.05, 0.16); }
        H('#F5B94E'); earRound('#F5B94E', '#C8742E', 0.3, 0.34, 0.11, 0.05);
        [-1, 1].forEach(function (m) { sph(head, '#FFF1D6', m * 0.08, -0.16, 0.37, 0.1, 0.08, 0.08); }); nose('#6B3A22', -0.08, 0.46, 0.05); eyes(0.17, 0.07, 0.065); cheeks(0.3, -0.08);
        parts.tail = sph(ch, '#C8742E', 0, -0.7, -0.4, 0.08); break;
      case 'tiger':
        body('#FF8A2B', '#FFF6EC'); H('#FF8A2B'); earRound('#FF8A2B', '#FFF6EC', 0.32, 0.34, 0.13);
        [[-0.08, 0.36, 0.2], [0, 0.4, 0], [0.08, 0.36, -0.2]].forEach(function (p) { stick(INK, p[0], p[1], 0.022, 0.08, 0.015, p[2]); });
        [-1, 1].forEach(function (m) { stick(INK, m * 0.42, 0.08, 0.022, 0.09, 0.015, Math.PI / 2 - m * 0.2); stick(INK, m * 0.4, -0.08, 0.022, 0.08, 0.015, Math.PI / 2 + m * 0.2); sph(head, '#FFF6EC', m * 0.09, -0.16, 0.36, 0.12, 0.09, 0.09); });
        nose('#FF6F91', -0.09, 0.47, 0.045); eyes(0.17, 0.07, 0.065); break;
      case 'monkey':
        body('#8B5A3C', '#F2C9A0'); H('#8B5A3C'); earRound('#8B5A3C', '#E8B48C', 0.5, 0, 0.15, 0, Math.PI / 2.4);
        sph(head, '#F2C9A0', 0, -0.1, 0.2, 0.36, 0.3, 0.32); [-1, 1].forEach(function (m) { sph(head, '#F2C9A0', m * 0.13, 0.08, 0.3, 0.16, 0.15, 0.18); });
        eye(-0.13, 0.08, 0.05, 0.48); eye(0.13, 0.08, 0.05, 0.48); [-1, 1].forEach(function (m) { sph(head, INK, m * 0.04, -0.06, 0.52, 0.018, 0.028, 0.015); }); smile(-0.12, 0.5, 0.11); break;
      case 'penguin':
        body('#26304A', '#FFFFFF'); H('#26304A'); sph(head, '#FFFFFF', 0, -0.07, 0.18, 0.38, 0.34, 0.34);
        eye(-0.15, 0.04, 0.05, 0.5); eye(0.15, 0.04, 0.05, 0.5); cone(head, '#FF9A3D', 0.07, 0.16, 0, -0.1, 0.6, Math.PI / 2);
        cone(head, '#26304A', 0.05, 0.15, 0, 0.55, 0); cheeks(0.27, -0.1, 0.52); break;
      case 'dog':
        body('#E3B26E', '#FFF1DA'); H('#E3B26E'); stick('#C98C4A', 0.16, 0.1, 0.12, 0.11, 0.04);
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.4, 0.22, 0); g.rotation.z = m * 0.3; sph(g, '#8A5A35', 0, -0.2, 0, 0.12, 0.26, 0.08); head.add(g); parts.ears.push(g); });
        sph(head, '#FFF1DA', 0, -0.14, 0.34, 0.2, 0.15, 0.14); nose(INK, -0.07, 0.47, 0.06); sph(head, '#FF6F91', 0, -0.26, 0.4, 0.05, 0.07, 0.03); eyes(0.17, 0.07, 0.065);
        parts.tail = sph(ch, '#E3B26E', 0, -0.48, -0.34, 0.06, 0.16, 0.06); break;
      case 'mouse':
        body('#BFA8DD', '#E9E5F0'); H('#BFA8DD');
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.32, 0.38, -0.02); g.rotation.z = -m * 0.3; sph(g, '#BFA8DD', 0, 0, 0, 0.22, 0.22, 0.06); sph(g, '#FFB3C7', 0, 0, 0.035, 0.14, 0.14, 0.03); head.add(g); parts.ears.push(g); });
        sph(head, '#BFA8DD', 0, -0.1, 0.36, 0.14, 0.12, 0.16); nose('#FF6F91', -0.08, 0.52, 0.035); whiskers(-0.1, 0.44); eyes(0.16, 0.07, 0.05); cheeks(0.28, -0.08);
        parts.tail = mesh(new T.TorusGeometry(0.18, 0.015, 6, 20, Math.PI), '#FFB3C7'); parts.tail.position.set(0, -0.8, -0.38); parts.tail.rotation.y = Math.PI / 2; ch.add(parts.tail); break;
      case 'raccoon':
        body('#8E8EA0', '#C9C9D6'); H('#8E8EA0'); earCone('#8E8EA0', '#3A3442', 0.27, 0.32, 0.13, 0.26, 0.25);
        sph(head, '#3A3442', 0, 0.06, 0.26, 0.4, 0.12, 0.24); [-1, 1].forEach(function (m) { stick('#FFFFFF', m * 0.16, 0.2, 0.1, 0.035, 0.02); });
        sph(head, '#FFFFFF', 0, -0.14, 0.34, 0.17, 0.12, 0.14); nose(INK, -0.08, 0.47, 0.045); eye(-0.16, 0.06, 0.04, 0.5, true); eye(0.16, 0.06, 0.04, 0.5, true);
        parts.tail = sph(ch, '#8E8EA0', 0, -0.62, -0.38, 0.1, 0.1, 0.24); break;
      case 'koala':
        body('#8F99AD', '#E4E6EC'); H('#8F99AD'); earRound('#8F99AD', '#F2EEF7', 0.42, 0.26, 0.2);
        sph(head, INK, 0, -0.06, 0.45, 0.08, 0.11, 0.07, true); eyes(0.18, 0.08, 0.045); cheeks(0.3, -0.12); break;
      case 'elephant':
        body('#86A9DA', '#C5D3E6', 1.1); H('#86A9DA');
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.44, 0.02, -0.06); g.rotation.y = m * 0.5; sph(g, '#86A9DA', 0, 0, 0, 0.32, 0.36, 0.06); sph(g, '#FFC7D6', 0, 0, 0.04, 0.22, 0.26, 0.03); head.add(g); parts.ears.push(g); });
        var tc = new T.CatmullRomCurve3([new T.Vector3(0, -0.05, 0.42), new T.Vector3(0, -0.25, 0.56), new T.Vector3(0, -0.45, 0.56), new T.Vector3(0, -0.52, 0.66)]);
        var tr = mesh(new T.TubeGeometry(tc, 20, 0.075, 12, false), '#86A9DA'); head.add(tr); sph(head, '#86A9DA', 0, -0.52, 0.66, 0.075);
        eyes(0.18, 0.1, 0.05); cheeks(0.3, -0.06); break;
      case 'hedgehog':
        body('#7A5236', '#F2D7B0'); H('#7A5236');
        dirs(130, function (d) { return d.z < 0.4 && d.y > -0.6; }).forEach(function (d) { var c = mesh(new T.ConeGeometry(0.055, 0.3, 8), '#4A2E1C'); c.position.copy(d).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); head.add(c); });
        sph(head, '#F2D7B0', 0, -0.06, 0.2, 0.36, 0.32, 0.32); sph(head, '#F2D7B0', 0, -0.1, 0.46, 0.1, 0.09, 0.12); nose(INK, -0.08, 0.58, 0.04);
        eye(-0.14, 0.06, 0.045, 0.48); eye(0.14, 0.06, 0.045, 0.48); cheeks(0.24, -0.08, 0.52); break;
      case 'sheep':
        body('#FFFFFF', null, 1.15); dirs(26, function (d) { return d.z < 0.45; }).forEach(function (d) { sph(head, '#FFFFFF', d.x * 0.44, d.y * 0.44, d.z * 0.44, 0.17); });
        sph(head, '#FFFFFF', 0, 0, 0, 0.45); sph(head, '#3A2E2A', 0, -0.06, 0.24, 0.28, 0.33, 0.28);
        [-1, 1].forEach(function (m) { var g = new T.Group(); g.position.set(m * 0.34, 0.02, 0.12); g.rotation.z = m * 0.5; sph(g, '#3A2E2A', 0, 0, 0, 0.14, 0.06, 0.08); head.add(g); parts.ears.push(g); });
        [[-0.1, 0.3], [0.1, 0.3], [0, 0.36]].forEach(function (p) { sph(head, '#FFFFFF', p[0], p[1], 0.3, 0.1); });
        eye(-0.11, 0.0, 0.04, 0.51, true); eye(0.11, 0.0, 0.04, 0.51, true); smile(-0.16, 0.5, 0.06, '#FFFFFF'); break;
      case 'cow':
        body('#FFFFFF', '#FFE0EA'); H('#FFFFFF'); stick(INK, -0.26, 0.2, 0.15, 0.12, 0.04, 0.4); stick(INK, 0.3, 0.26, 0.1, 0.08, 0.04, -0.3);
        [-1, 1].forEach(function (m) { cone(head, '#F3E3C3', 0.05, 0.16, m * 0.24, 0.46, 0, 0, -m * 0.6); var g = new T.Group(); g.position.set(m * 0.46, 0.14, 0); g.rotation.z = -m * 0.3; sph(g, '#FFFFFF', 0, 0, 0, 0.16, 0.07, 0.09); head.add(g); parts.ears.push(g); });
        sph(head, '#FFB3C7', 0, -0.2, 0.32, 0.28, 0.16, 0.18); [-1, 1].forEach(function (m) { sph(head, '#C2557A', m * 0.09, -0.19, 0.49, 0.03, 0.045, 0.02); });
        eyes(0.18, 0.1, 0.05); sph(ch, INK, 0.14, -0.55, 0.22, 0.09, 0.08, 0.04); break;
      case 'chick':
        body('#FFD84D', '#FFE88A'); H('#FFD84D'); [[-0.06, -0.4], [0.05, 0.25]].forEach(function (p) { var f = sph(head, '#FFD84D', p[0], 0.55, 0, 0.05, 0.13, 0.05); f.rotation.z = p[1]; });
        cone(head, '#FF9A3D', 0.07, 0.14, 0, -0.08, 0.55, Math.PI / 2); eyes(0.17, 0.08, 0.065); cheeks(0.3, -0.08); break;
      case 'unicorn':
        body('#F7F3FF', '#FFE0EA'); [['#FFD84D', -0.08, 0.42, -0.12], ['#FF9DBF', -0.26, 0.32, -0.2], ['#A9C8FF', -0.36, 0.12, -0.24], ['#C9F2DE', -0.38, -0.1, -0.2], ['#FF9DBF', 0.2, 0.36, -0.14]].forEach(function (c) { sph(head, c[0], c[1], c[2], c[3], 0.15); });
        H('#F7F3FF'); earCone('#F7F3FF', '#FFC7D6', 0.26, 0.33, 0.11, 0.24, 0.25);
        var horn = cone(head, '#FFD84D', 0.07, 0.42, 0, 0.62, 0.12, -0.25, 0, 24); horn.material = M('#FFD84D', true);
        sph(head, '#FF9DBF', -0.14, 0.34, 0.25, 0.1); sph(head, '#A9C8FF', 0.02, 0.4, 0.24, 0.09);
        sph(head, '#FFE0EA', 0, -0.18, 0.34, 0.2, 0.13, 0.14); [-1, 1].forEach(function (m) { sph(head, '#C2557A', m * 0.07, -0.17, 0.47, 0.02, 0.03, 0.015); });
        eyes(0.17, 0.05, 0.065); cheeks(0.3, -0.1); break;
      default:
        body('#FF9FB8'); H('#FF9FB8'); eyes(0.17, 0.07, 0.065);
    }
    return { root: root, ch: ch, head: head, eyes: parts.eyes, ears: parts.ears, tail: parts.tail };
  };

  // A character marker for WWMap: stands on a glossy token, hops slowly, faces the camera, blinks.
  Z3.marker = function (ctx, g, i, at, color, opts) {
    opts = opts || {};
    var T = ctx.T;
    if (!ctx.env) ctx.env = Z3.env(T, ctx.renderer);
    var grp = new T.Group(); grp.position.set(at.x, at.y, at.z); ctx.scene.add(grp);
    var tokM = new T.MeshPhysicalMaterial({ color: new T.Color(color), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMap: ctx.env, envMapIntensity: 0.8 });
    var tok = new T.Mesh(new T.CylinderGeometry(0.5, 0.56, 0.1, 40), tokM); tok.position.y = 0.05; tok.castShadow = true; tok.receiveShadow = true; grp.add(tok);
    var ring = new T.Mesh(new T.RingGeometry(0.62, 0.74, 40), new T.MeshBasicMaterial({ color: new T.Color(color), transparent: true, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grp.add(ring);
    var a = Z3.build(T, g.animal, ctx.env);
    var hold = new T.Group(); hold.add(a.root); grp.add(hold);
    var puffM = new T.MeshBasicMaterial({ color: 0xFFFDF8, transparent: true, opacity: 0, depthWrite: false });
    var puffs = []; for (var k = 0; k < 7; k++) { var p = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), puffM); p.visible = false; grp.add(p); puffs.push({ m: p, a: k / 7 * Math.PI * 2 }); }
    var base = opts.scale || 1.25, S = base, h = 0, drop = 0, yaw = null, spin = 0, wasAir = false, puffT = 9, blinkAt = 2 + (i % 7) * 0.7, earAt = 3 + (i % 5);
    var ph = (i * 0.61) % 3.4, born = performance.now() / 1000 + (opts.delay == null ? 0.2 + i * 0.05 : opts.delay), tmp = new T.Vector3();
    return {
      i: i, pick: [a.root, tok],
      remove: function () { ctx.scene.remove(grp); },
      update: function (t, dt, isF) {
        S += ((isF ? base * 1.35 : base) - S) * Math.min(1, dt * 4);
        var per = isF ? 1.7 : 3.4, u = ((t + ph) % per) / per, air = isF ? 0.55 : 0.36, sy = 1, sx = 1;
        h = 0; drop = 0;
        if (u < air) { var kk = u / air, s = Math.sin(Math.PI * kk); h = s * (isF ? 1.5 : 0.8); sy = 1 + 0.12 * s; sx = 1 - 0.05 * s; }
        else { var k2 = (u - air) / (1 - air); if (k2 < 0.14) { var q = Math.sin(Math.PI * k2 / 0.14); sy = 1 - 0.2 * q; sx = 1 + 0.12 * q; } }
        var inAir = u < air; if (wasAir && !inAir) puffT = 0; wasAir = inAir;
        var life = performance.now() / 1000 - born;
        if (life < 1.2) { var e = Math.max(0, life) / 1.2, dropH = Math.pow(1 - Math.min(1, e * 1.6), 2) * 14; drop = dropH; h += dropH + (e > 0.62 ? Math.abs(Math.sin((e - 0.62) / 0.38 * Math.PI)) * 0.6 * (1 - e) : 0); }
        hold.visible = life > 0; // outside the drop-in: a long first frame (shader compile) can skip it entirely
        hold.position.y = 0.1 + h; hold.scale.set(sx * S, sy * S, sx * S);
        tmp.copy(ctx.cam.position).sub(grp.position);
        var want = Math.atan2(tmp.x, tmp.z) + Math.sin(t * 0.9 + i) * 0.25;
        if (yaw === null) yaw = want; var d = want - yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; yaw += d * Math.min(1, dt * 3);
        if (isF && inAir) spin = (u / air) * Math.PI * 2; else spin *= 0.85;
        hold.rotation.y = yaw + spin;
        a.head.rotation.z = Math.sin(t * 1.3 + i) * 0.08; a.head.rotation.x = -0.12 + Math.sin(t * 0.8 + i * 2) * 0.05;
        var bt = (t + i * 0.37) % 4.2, bl = bt < 0.14 ? 0.12 : 1; a.eyes.forEach(function (e) { e.scale.y = bl; });
        var et = (t + i * 0.53) % 5, wig = et < 0.5 ? Math.sin(et / 0.5 * Math.PI * 4) * 0.25 : 0; a.ears.forEach(function (e, n) { e.rotation.x = (e.userData.rx0 == null ? (e.userData.rx0 = e.rotation.x) : e.userData.rx0) + wig * (n % 2 ? 1 : -1); });
        if (a.tail) a.tail.rotation.y = Math.sin(t * 6 + i) * 0.4;
        puffT += dt; var pl = Math.min(1, puffT / 0.5);
        puffs.forEach(function (p) { p.m.visible = pl < 1; if (pl < 1) { var r = 0.4 + pl * 0.6 * S; p.m.position.set(Math.cos(p.a) * r, 0.1 + pl * 0.15, Math.sin(p.a) * r); p.m.scale.setScalar((0.6 + pl) * S * 0.8); } });
        puffM.opacity = pl < 1 ? 0.85 * (1 - pl) : 0;
        var pu = (t * 0.5 + i * 0.13) % 1; ring.scale.setScalar(S * (0.9 + pu * 0.8)); ring.material.opacity = 0.9 * (1 - pu);
      },
      anchor: function (v) { return v.set(at.x, at.y + 0.1 + (h - drop) + 1.85 * S, at.z); } // camera/labels ignore the drop-in
    };
  };
})();
