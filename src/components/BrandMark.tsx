export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <picture className="logo-lottie" style={{ width: size, height: size, display: "block" }}>
      <source srcSet="/images/logo-static.webp" media="(prefers-reduced-motion: reduce)" />
      <img
        src="/images/logo-animated.webp"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    </picture>
  );
}
