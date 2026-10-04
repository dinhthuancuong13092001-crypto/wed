import type { AppProps } from "next/app";
import "@/styles/globals.css";
import Accessibility from "@/components/Accessibility";
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Accessibility />
      <Component {...pageProps} />
    </>
  );
}
