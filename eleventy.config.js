module.exports = function(eleventyConfig) {
  eleventyConfig.addFilter("dateFormat", (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  return {
    pathPrefix: "/agents/rook/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};
