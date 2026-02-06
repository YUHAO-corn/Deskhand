/**
 * @deskhand/shared/config
 *
 * Configuration management exports.
 */

export {
  getConfigDir,
  getConfigPath,
  getCredentialsPath,
  loadConfig,
  saveConfig,
  saveApiKey,
  getApiKey,
  hasApiKey,
  deleteApiKey,
  encryptCredential,
  decryptCredential,
} from './storage.ts';
