/**
 * Utility functions for permission management
 */

/**
 * Format group name - capitalize first letter after each space
 * @param {string} groupName - Raw group name
 * @returns {string} - Formatted group name
 */
const formatGroupName = (groupName) => {
  if (!groupName || typeof groupName !== 'string') {
    return 'default';
  }

  return groupName
    .trim()
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

module.exports = {
  formatGroupName,
};
