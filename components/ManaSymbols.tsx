"use client";

const PIP_CLASSES: Record<string, string> = {
  W: "pip pip-W", U: "pip pip-U", B: "pip pip-B",
  R: "pip pip-R", G: "pip pip-G", C: "pip pip-C",
};

interface Props {
  identity: string;
  size?: "sm" | "md" | "lg";
}

export default function ManaSymbols({ identity, size = "md" }: Props) {
  if (!identity || identity === "?") return null;
  const order = ["W", "U", "B", "R", "G", "C"];
  const colors = order.filter(c => identity.toUpperCase().includes(c));
  const px = size === "sm" ? "10px" : size === "lg" ? "18px" : "14px";

  return (
    <span className="inline-flex items-center gap-0.5">
      {colors.map(c => (
        <span key={c} className={PIP_CLASSES[c]} style={{ width: px, height: px, fontSize: `calc(${px} * 0.5)` }} />
      ))}
    </span>
  );
}
