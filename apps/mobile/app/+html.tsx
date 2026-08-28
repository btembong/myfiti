import { ScrollViewStyleReset } from 'expo-router/html'

// Controls the web <html> shell. Sets body background to the app's dark
// base color so transparent areas (QR float zone, scroll overrun) don't
// flash white or the splash purple (#6C47FF).
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              background-color: #0B0B10;
              height: 100%;
            }
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
