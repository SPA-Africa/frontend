import type { Messages } from './types';
import { common } from './common';
import { nav } from './nav';
import { public as publicMessages } from './public';
import { learner } from './learner';
import { org } from './org';
import { internal } from './internal';
import { admin } from './admin';
import { site } from './site';

export const messages: Messages = { ...common, ...nav, ...publicMessages, ...learner, ...org, ...internal, ...admin, ...site };
