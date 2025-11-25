# Vex ESLint Configuration

This package provides shared ESLint configurations for the Vex monorepo.

## ✨ Features

*   **Shared Configurations**: The package includes a base configuration and specialized configurations for Next.js and React libraries.
*   **Best Practices**: The configurations are designed to enforce best practices and help to catch errors early.
*   **Easy to Use**: The configurations are easy to use and can be extended to meet the specific needs of each project.

## 🚀 Usage

To use a configuration in your project, extend it in your `.eslintrc.js` file.

### Base Configuration

This is the base configuration, which is intended to be used for all projects in the monorepo.

```javascript
module.exports = {
  extends: ["@repo/eslint-config/base"],
};
```

### Next.js Configuration

This configuration is intended to be used for Next.js projects.

```javascript
module.exports = {
  extends: ["@repo/eslint-config/next-js"],
};
```

### React Internal Configuration

This configuration is intended to be used for internal React libraries.

```javascript
module.exports = {
  extends: ["@repo/eslint-config/react-internal"],
};
```

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.
