module.exports = {
  root: true,
  extends: [
    "@react-native-community/eslint-config",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks", "prettier"],
  rules: {
    "prettier/prettier": [
      "error",
      {
        arrowParens: "avoid",
        bracketSameLine: true,
        bracketSpacing: false,
        singleQuote: true,
        trailingComma: "all"
      }
    ],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "no-use-before-define": "off",
    // "@typescript-eslint/no-use-before-define": ["error"],
    // Add this rule to allow ES module imports in the server file
    "@typescript-eslint/no-var-requires": "off",
  },
  settings: {
    react: {
      version: "detect"
    }
  }
};