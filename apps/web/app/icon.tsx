import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "64px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#070A0F",
      }}
    >
      <div
        style={{
          width: "54px",
          height: "54px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07110F",
          border: "2px solid #14B8A6",
          color: "#E9FFFC",
          fontSize: "26px",
          fontWeight: 800,
          clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        }}
      >
        R
      </div>
    </div>,
    size,
  );
}
