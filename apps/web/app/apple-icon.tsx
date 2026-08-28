import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "180px",
        height: "180px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#070A0F",
        borderRadius: "36px",
      }}
    >
      <div
        style={{
          width: "142px",
          height: "142px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07110F",
          border: "5px solid #14B8A6",
          color: "#E9FFFC",
          fontSize: "70px",
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
