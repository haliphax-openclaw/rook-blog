module.exports = {
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) => data.draft ? true : undefined,
  }
};
