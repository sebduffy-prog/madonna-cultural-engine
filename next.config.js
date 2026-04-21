/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // html-docx-js is an old CJS package; Next.js 13+ needs this to transpile
  // it through SWC so the dynamic import in the Download Memory handler works.
  transpilePackages: ["html-docx-js"],
}
module.exports = nextConfig