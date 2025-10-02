import esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import CleanCSS from 'clean-css';
import { minify as minifyHTML } from 'html-minifier-terser';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

async function buildJS(file) {
    console.log(`Building ${file}...`);
    
    const inputPath = join(__dirname, '..', 'frontend', file);
    const outputPath = join(__dirname, '..', 'frontend', file.replace('.js', '.min.js'));
    
    if (file === 'phone.js') {
        const code = readFileSync(inputPath, 'utf8');
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
        writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
        console.log(`✓ ${file} obfuscated (no build)`);
        return;
    }
    
    const externals = file === 'admin.js' ? ['react', 'react-dom'] : [];
    
    const result = await esbuild.build({
        entryPoints: [inputPath],
        bundle: true,
        format: 'iife',
        loader: { '.js': 'jsx' },
        minify: true,
        target: 'es2015',
        external: externals,
        globalName: file === 'admin.js' ? 'AdminApp' : undefined,
        write: false
    });
    
    const minifiedCode = result.outputFiles[0].text;
    const obfuscationResult = JavaScriptObfuscator.obfuscate(minifiedCode, obfuscatorOptions);
    
    writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
    console.log(`✓ ${file} obfuscated`);
}

function buildCSS(file) {
    console.log(`Building ${file}...`);
    
    const inputPath = join(__dirname, '..', 'frontend', file);
    const outputPath = join(__dirname, '..', 'frontend', file.replace('.css', '.min.css'));
    
    const css = readFileSync(inputPath, 'utf8');
    
    const output = new CleanCSS({
        level: {
            1: { all: true },
            2: { all: true }
        },
        format: false
    }).minify(css);
    
    const oneLine = output.styles.replace(/\n/g, '').replace(/\s+/g, ' ').trim();
    
    writeFileSync(outputPath, oneLine);
    console.log(`✓ ${file} minified`);
}

async function buildHTML(file) {
    console.log(`Building ${file}...`);
    
    const inputPath = join(__dirname, '..', 'frontend', file);
    const outputPath = join(__dirname, '..', 'frontend', file.replace('.html', '.min.html'));
    
    let html = readFileSync(inputPath, 'utf8');
    
    html = html
        .replace(/(?<!\.min)\.js"/g, '.min.js"')
        .replace(/(?<!\.min)\.css"/g, '.min.css"')
        .replace(/type="text\/babel"\s*/g, '');
    
    const minified = await minifyHTML(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
        removeEmptyAttributes: true,
        removeOptionalTags: true
    });
    
    writeFileSync(outputPath, minified);
    console.log(`✓ ${file} minified`);
}

async function build() {
    console.log('🔨 Starting production build...\n');
    
    const jsFiles = ['chat.js', 'auth.js', 'profile.js', 'dashboard.js', 'admin.js', 'phone.js'];
    const cssFiles = ['chat.css', 'auth.css', 'profile.css', 'style.css', 'admin.css'];
    const htmlFiles = ['chat.html', 'auth.html', 'profile.html', 'dashboard.html', 'admin.html'];
    
    for (const file of jsFiles) {
        await buildJS(file);
    }
    
    for (const file of cssFiles) {
        buildCSS(file);
    }
    
    for (const file of htmlFiles) {
        await buildHTML(file);
    }
    
    console.log('\n✅ Build complete!');
}

build().catch(console.error);