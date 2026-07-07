export default function UnknownBlock({ type }: { type: string }) {
  if (process.env.NODE_ENV !== "production") {
    return (
      <div
        style={{
          color: "var(--color-muted)",
          border: "1px dashed var(--color-muted)",
          padding: "1rem",
          margin: "1rem 0",
          fontFamily: "monospace",
          fontSize: "0.875rem",
        }}
      >
        [dev] Unknown block type: &ldquo;{type}&rdquo;
      </div>
    );
  }

  return null;
}
