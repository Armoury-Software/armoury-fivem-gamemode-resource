const esbuild = require('esbuild');
const esbuildPluginTsc = require('esbuild-plugin-tsc');
const fs = require('fs/promises');
const path = require('path');

const clientFilePath = 'dist/client/dist.client.js';
const serverFilePath = 'dist/server/dist.server.js';

const cleanupPlugin = (outputFile) => ({
    name: 'fivem-native-names',
    setup(build) {
        build.onEnd(async (result) => {
            if (result.errors.length) return;

            const filePath = path.join(__dirname, outputFile);
            const data = await fs.readFile(filePath, 'utf8');
            // The framework declares natives under Cfx; FiveM exposes them as globals.
            const modifiedContent = data
                .replace(/Cfx\.Client\./g, '')
                .replace(/Cfx\.Server\./g, '')
                .replace(/Cfx\./g, '');
            await fs.writeFile(filePath, modifiedContent, 'utf8');
            console.log(`[Armoury:] Built ${outputFile}`);
        });
    },
});

const config = (entryPoint, outputFile, server = false) => ({
    absWorkingDir: __dirname,
    tsconfig: path.join(__dirname, 'tsconfig.json'),
    entryPoints: [entryPoint],
    bundle: true,
    outfile: outputFile,
    platform: server ? 'node' : 'browser',
    format: server ? 'cjs' : 'iife',
    // FiveM loads resource scripts in a context containing native-binding globals.
    // CommonJS output alone does not supply Node's module wrapper in that context.
    ...(server && {
        banner: { js: '(() => {' },
        footer: { js: '})();' },
    }),
    target: server ? 'node22' : 'es2020',
    plugins: [
        // Keep metadata emission enabled in both production and watch builds.
        esbuildPluginTsc({
            tsconfigPath: path.join(__dirname, 'tsconfig.json'),
            force: true,
        }),
        cleanupPlugin(outputFile),
    ],
    minifyWhitespace: true,
    minifyIdentifiers: false, // NUI callback listeners depend on function names.
    minifySyntax: true,
});

async function main() {
    const configs = [
        config('src/client/client.ts', clientFilePath),
        config('src/server/server.ts', serverFilePath, true),
    ];

    if (process.argv.includes('--watch')) {
        const contexts = [];
        try {
            for (const options of configs) {
                contexts.push(await esbuild.context(options));
            }
            await Promise.all(contexts.map((context) => context.watch()));
            console.log('[Armoury:] Development watch mode started.');
        } catch (error) {
            await Promise.all(contexts.map((context) => context.dispose()));
            throw error;
        }
    } else {
        for (const options of configs) {
            await esbuild.build(options);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
