const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const site = require("./src/_data/site.json");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({
    "node_modules/@exampledev/new.css/new.css": "assets/new.css",
    "node_modules/@exampledev/new.css/theme/terminal.css": "assets/terminal.css"
  });
  eleventyConfig.addFilter("dateFormat", (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  return {
    pathPrefix: site.pathPrefix,
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};
