import { disableTool } from 'eve/tools';

/**
 * scout researches and writes to Circle. It has no reason to touch a
 * filesystem or run shell commands, so the capability is removed rather than
 * left to the model's judgement.
 */
export default disableTool();
