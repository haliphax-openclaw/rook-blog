module.exports = function(eleventyConfig) {
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
    pathPrefix: process.env.PATH_PREFIX ?? "/agents/rook/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};
