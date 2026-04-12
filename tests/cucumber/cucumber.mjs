export default {
  default: {
    paths: ["features/**/*.feature"],
    import: ["features/step_definitions/**/*.js", "support/**/*.js"],
    format: [
      "progress",
      "json:results/cucumber-report.json"
    ],
    publishQuiet: true
  }
};
