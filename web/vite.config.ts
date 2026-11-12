import { defineConfig } from "vite";

export default defineConfig({
	// 相対パスで出力し、サブディレクトリに置いても動くようにする
	base: "./",
	build: {
		outDir: "../dist-web",
		emptyOutDir: true,
		target: "es2022",
	},
});
