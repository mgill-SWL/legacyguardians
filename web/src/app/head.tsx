export default function Head() {
  return (
    <>
      {/* Brand kit favicon snippet */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32" />
      <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {/* PWA */}
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#2E4A7F" />
    </>
  );
}

