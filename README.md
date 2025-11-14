# Setting Up TypeScript in a Node.js Project

This guide walks you through setting up TypeScript in a Node.js project from scratch.

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) installed

## 1. Initialize a New Node.js Project

Run the following command to create a `package.json` file:

```bash
npm init -y
```

## 2. Install TypeScript and Required Dependencies

Install TypeScript and the necessary type definitions:

```bash
npm install --save-dev typescript ts-node @types/node
```

## 3. Initialize TypeScript Configuration

Run the following command to generate a `tsconfig.json` file:

```bash
npx tsc --init
```

This creates a `tsconfig.json` file where you can customize TypeScript settings.

### Recommended `tsconfig.json` Settings

Modify the generated `tsconfig.json` file to match the following setup:

```json
{
  "compilerOptions": {
    "target": "ES6",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]

```

## 4. Create the Project Structure

Organize your project as follows:

```sql

/node-project
 ├── /src
 │    ├── index.ts
 ├── /dist  (will be generated)
 ├── package.json
 ├── tsconfig.json
 ├── .gitignore

```

## 5. Write TypeScript Code

Create a `src/index.ts` file:

```tsx
const greet = (name: string): string => {
  return `Hello, ${name}!`;
};

console.log(greet("Bernardo"));
```

## 6. Compile TypeScript Code

Run the TypeScript compiler:

```bash
npx tsc
```

This will generate JavaScript files inside the `dist/` folder.

## 7. Run the Compiled Code

Execute the compiled JavaScript file:

```bash
node dist/index.js
```

## 8. Run TypeScript Code Directly (Optional)

For development, you can run TypeScript files without compiling manually using `ts-node`:

```bash
npx ts-node src/index.ts
```

## 9. Add Scripts to `package.json`

To make running commands easier, update `package.json`:

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "ts-node src/index.ts",
  "build": "tsc"
}
```

Now, you can use:

- `npm run dev` → Run TypeScript code directly
- `npm run build` → Compile TypeScript code
- `npm start` → Run compiled JavaScript

## 10. Ignore `dist` Folder in Git

Create a `.gitignore` file and add:

```sql
node_modules/
dist/
```

# 📌 Adding Nodemon to a TypeScript + Node.js Project

### 1. Install `nodemon` and `ts-node`

Run the following command to install `nodemon` globally (optional) and as a development dependency:

```bash
npm install --save-dev nodemon ts-node
```

Alternatively, if you want to install `nodemon` globally:

```bash
npm install -g nodemon
```

### 2. Create a `nodemon.json` Configuration File

Create a `nodemon.json` file in the root of your project and add:

```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "ts-node src/index.ts"
}
```

### 3. Update `package.json` Scripts

Modify the `scripts` section in your `package.json`:

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "nodemon",
  "build": "tsc"
}

```

### 4. Run Your TypeScript Project with Nodemon

Now, simply run:

```bash
npm run dev
```

Nodemon will watch your `src/` directory and restart the app whenever a `.ts` file changes.
