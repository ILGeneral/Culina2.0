/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", 
    "./components/**/*.{js,jsx,ts,tsx}",
    "./recipes/**/*.{js,jsx,ts,tsx}",  // Add this
    "./recipe/**/*.{js,jsx,ts,tsx}",   // Add this
    "./report/**/*.{js,jsx,ts,tsx}",   // Add this
  ],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};