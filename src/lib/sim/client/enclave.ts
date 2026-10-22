"use client";

// Stand-in for the Tide enclave pop-up in which an admin approves a policy or a change request.
// A plain DOM overlay, clearly labelled SIMULATED: nothing here talks to the Tide network.
export function simEnclave(opts: { title: string; lines: string[]; approveLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(15,23,42,.55);font-family:system-ui,sans-serif";
    const card = document.createElement("div");
    card.style.cssText = "width:min(440px,92vw);background:#fff;color:#0f172a;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.35)";
    const tag = document.createElement("p");
    tag.textContent = "SIMULATED TIDE ENCLAVE";
    tag.style.cssText = "margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.12em;color:#b45309";
    const h = document.createElement("h2");
    h.textContent = opts.title;
    h.style.cssText = "margin:0 0 12px;font-size:18px";
    const list = document.createElement("ul");
    list.style.cssText = "margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.6;color:#334155";
    for (const l of opts.lines) {
      const li = document.createElement("li");
      li.textContent = l;
      list.appendChild(li);
    }
    const note = document.createElement("p");
    note.textContent = "No Tide network is involved. This confirmation stands in for the approval an admin gives in their own enclave.";
    note.style.cssText = "margin:0 0 16px;font-size:12px;color:#64748b";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
    const done = (v: boolean) => {
      root.remove();
      resolve(v);
    };
    const mk = (label: string, primary: boolean, v: boolean) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = `height:36px;padding:0 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid ${primary ? "#0f172a" : "#cbd5e1"};background:${primary ? "#0f172a" : "#fff"};color:${primary ? "#fff" : "#0f172a"}`;
      b.onclick = () => done(v);
      return b;
    };
    row.append(mk("Deny", false, false), mk(opts.approveLabel ?? "Approve", true, true));
    card.append(tag, h, list, note, row);
    root.appendChild(card);
    document.body.appendChild(root);
    (row.lastChild as HTMLButtonElement).focus();
  });
}
