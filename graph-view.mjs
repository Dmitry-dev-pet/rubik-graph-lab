import { FACE_COLORS, easeCubic } from "./core.mjs";
import { centerLabels, createGraphLayout } from "./graph-layouts.mjs";

const SVG = "http://www.w3.org/2000/svg";
const TAIL_MS = 140;
const SEG_POOL = 12;

const spring = (t) =>
  t >= 1 ? 1 : 1 - Math.exp(-5 * t) * Math.cos(4 * t);

function svgElement(name, attrs = {}) {
  const el = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function committedPositions(layout, data, state) {
  const byToken = new Array(48);
  for (let slot = 0; slot < state.length; slot += 1) {
    const token = state[slot];
    const target = layout.slots.get(data.slots[slot].label);
    byToken[token] = {
      token,
      x: target.x,
      y: target.y,
      moving: false,
      ringKeys: [],
    };
  }
  return byToken;
}

function activePositions(layout, data, active, t) {
  const e = layout.id === "one" ? easeCubic(t) : spring(t);
  const byToken = new Array(48);

  for (let source = 0; source < active.old.length; source += 1) {
    const token = active.old[source];
    const destination = active.permutation[source];
    const sourceLabel = data.slots[source].label;

    if (destination === source) {
      const point = layout.slots.get(sourceLabel);
      byToken[token] = {
        token,
        x: point.x,
        y: point.y,
        moving: false,
        ringKeys: [],
      };
      continue;
    }

    const destinationLabel = data.slots[destination].label;
    const path = layout.path(sourceLabel, destinationLabel);
    const angle = path.a0 + path.delta * e;
    const radius = path.r0 + (path.r1 - path.r0) * e;
    byToken[token] = {
      token,
      x: path.cx + radius * Math.cos(angle),
      y: path.cy + radius * Math.sin(angle),
      moving: true,
      ringKeys: path.ringKeys,
      cx: path.cx,
      cy: path.cy,
      angle,
      radius,
    };
  }

  return byToken;
}

export class GraphView {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.onHover = callbacks.onHover ?? (() => {});
    this.onClick = callbacks.onClick ?? (() => {});
    this.mode = null;
    this.layout = null;
    this.svg = null;
    this.ringEls = new Map();
    this.nodeEls = [];
    this.tailEls = [];
    this.histories = Array.from({ length: 48 }, () => []);
    this.activeRef = null;
    this.labelEl = null;
    this.centerGroup = null;
  }

  setMode(mode, data) {
    if (this.mode === mode && this.layout) return;
    this.mode = mode;
    this.layout = createGraphLayout(mode, data);
    this.activeRef = null;
    this.histories = Array.from({ length: 48 }, () => []);

    const [x, y, width, height] = this.layout.viewBox;
    const svg = svgElement("svg", {
      viewBox: `${x} ${y} ${width} ${height}`,
      "aria-label": `${this.layout.title} Rubik sticker graph`,
      role: "img",
    });
    svg.classList.add("graph-svg");

    const ringGroup = svgElement("g", { fill: "none" });
    ringGroup.classList.add("graph-rings");
    this.ringEls.clear();

    for (const ring of this.layout.rings) {
      const circle = svgElement("circle", {
        cx: ring.cx,
        cy: ring.cy,
        r: ring.r,
        stroke: "#b9b09f",
        "stroke-width": 1.35,
      });
      circle.dataset.key = ring.key;
      ringGroup.append(circle);
      this.ringEls.set(ring.key, circle);
    }
    svg.append(ringGroup);

    const trailGroup = svgElement("g", { fill: "none" });
    trailGroup.classList.add("graph-trails");
    this.tailEls = [];
    for (let token = 0; token < 48; token += 1) {
      const segs = [];
      for (let i = 0; i < SEG_POOL; i += 1) {
        const path = svgElement("path", {
          fill: "none",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          opacity: 0,
        });
        path.style.display = "none";
        trailGroup.append(path);
        segs.push(path);
      }
      this.tailEls[token] = segs;
    }
    svg.append(trailGroup);

    const centerGroup = svgElement("g");
    this.centerGroup = centerGroup;
    for (const label of centerLabels()) {
      const slot = this.layout.slots.get(label);
      const face = label[0];
      const circle = svgElement("circle", {
        cx: slot.x,
        cy: slot.y,
        r: mode === "nine" ? 6.2 : 5.2,
        fill: FACE_COLORS[face],
        stroke: "#2b2b2b",
        "stroke-width": 1.2,
      });
      circle.classList.add("graph-center");
      centerGroup.append(circle);
    }
    svg.append(centerGroup);

    const nodeGroup = svgElement("g");
    nodeGroup.classList.add("graph-nodes");
    this.nodeEls = [];

    for (let token = 0; token < 48; token += 1) {
      const face = data.slots[token].solved_color;
      const circle = svgElement("circle", {
        r: mode === "nine" ? 6.2 : 6.0,
        fill: FACE_COLORS[face],
        stroke: "#2b2b2b",
        "stroke-width": 1.25,
      });
      circle.classList.add("graph-node");
      circle.dataset.token = String(token);
      circle.addEventListener("pointerenter", () => this.onHover(token));
      circle.addEventListener("pointerleave", () => this.onHover(null));
      circle.addEventListener("click", () => this.onClick(token));
      nodeGroup.append(circle);
      this.nodeEls[token] = circle;
    }
    svg.append(nodeGroup);

    this.labelEl = svgElement("text", {
      x: 150,
      y: 286,
      "text-anchor": "middle",
      "font-size": 10,
      "font-family": "IBM Plex Mono, ui-monospace, monospace",
      fill: "#6f685e",
      opacity: 0,
    });
    svg.append(this.labelEl);

    this.svg = svg;
    this.host.replaceChildren(svg);
  }

  updateRings(activeKeys) {
    for (const [key, circle] of this.ringEls) {
      const active = activeKeys.has(key);
      circle.setAttribute("stroke", active ? "#6b655a" : "#b9b09f");
      circle.setAttribute("stroke-width", active ? "2.0" : "1.35");
      circle.setAttribute("opacity", active ? "1" : "0.76");
    }
  }

  hideTrail(token) {
    for (const path of this.tailEls[token] ?? []) {
      path.style.display = "none";
      path.setAttribute("opacity", "0");
    }
  }

  resetHistories(active) {
    if (!active) {
      this.activeRef = null;
      return;
    }
    if (this.activeRef === active) return;
    this.activeRef = active;
    this.histories = Array.from({ length: 48 }, () => []);
    for (let token = 0; token < 48; token += 1) this.hideTrail(token);
  }

  renderTail(token, now, color) {
    const history = this.histories[token];
    const segs = this.tailEls[token] ?? [];
    const cutoff = now - TAIL_MS;

    while (history.length > 1 && history[0].ts < cutoff) history.shift();

    const n = history.length - 1;
    const first = Math.max(0, n - segs.length);
    for (let i = 0; i < segs.length; i += 1) {
      const path = segs[i];
      const si = first + i;
      if (si >= n) {
        path.style.display = "none";
        continue;
      }

      const s0 = history[si];
      const s1 = history[si + 1];
      const da = s1.angle - s0.angle;
      if (Math.abs(da) < 0.001) {
        path.style.display = "none";
        continue;
      }

      const age = Math.min(1, (now - s1.ts) / TAIL_MS);
      const ar = (s0.radius + s1.radius) / 2;
      const x0 = s0.cx + s0.radius * Math.cos(s0.angle);
      const y0 = s0.cy + s0.radius * Math.sin(s0.angle);
      const x1 = s1.cx + s1.radius * Math.cos(s1.angle);
      const y1 = s1.cy + s1.radius * Math.sin(s1.angle);
      const large = Math.abs(da) > Math.PI ? 1 : 0;
      const sweep = da > 0 ? 1 : 0;

      path.setAttribute("d", `M ${x0} ${y0} A ${ar} ${ar} 0 ${large} ${sweep} ${x1} ${y1}`);
      path.setAttribute("stroke", color);
      path.setAttribute(
        "stroke-width",
        (6.2 * Math.pow(1 - age, 1.4) + 0.55).toFixed(2),
      );
      path.setAttribute(
        "opacity",
        (0.72 * Math.pow(1 - age, 1.2)).toFixed(3),
      );
      path.style.display = "";
    }
  }

  render({
    mode,
    data,
    state,
    active,
    t,
    selectedToken = null,
    showLabels = false,
    showTrails = true,
  }) {
    this.setMode(mode, data);
    this.resetHistories(active);

    const now = performance.now();
    const positions = active
      ? activePositions(this.layout, data, active, t)
      : committedPositions(this.layout, data, state);

    const activeRingKeys = new Set();
    const selectedLabel =
      selectedToken === null ? "" : data.slots[selectedToken].label;

    for (let token = 0; token < positions.length; token += 1) {
      const point = positions[token];
      const node = this.nodeEls[token];
      node.setAttribute("cx", point.x.toFixed(4));
      node.setAttribute("cy", point.y.toFixed(4));

      if (point.moving) {
        for (const key of point.ringKeys) activeRingKeys.add(key);
      }

      const selected = token === selectedToken;
      node.setAttribute("stroke", selected ? "#111111" : "#2b2b2b");
      node.setAttribute("stroke-width", selected ? "3.0" : point.moving ? "1.65" : "1.25");
      node.setAttribute("r", selected ? "7.5" : this.mode === "nine" ? "6.2" : "6.0");

      const color = FACE_COLORS[data.slots[token].solved_color];
      if (active && point.moving && showTrails) {
        this.histories[token].push({
          ts: now,
          angle: point.angle,
          radius: point.radius,
          cx: point.cx,
          cy: point.cy,
        });
      } else if (!showTrails) {
        this.histories[token] = [];
      }

      if (showTrails) this.renderTail(token, now, color);
      else this.hideTrail(token);
    }

    this.updateRings(activeRingKeys);

    if (selectedToken !== null && showLabels) {
      const p = positions[selectedToken];
      this.labelEl.setAttribute("x", p.x);
      this.labelEl.setAttribute("y", Math.min(294, p.y + 18));
      this.labelEl.textContent = selectedLabel;
      this.labelEl.setAttribute("opacity", "1");
    } else {
      this.labelEl.setAttribute("opacity", "0");
    }
  }
}
