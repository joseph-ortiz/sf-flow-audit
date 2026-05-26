#!/usr/bin/env node
// Dev runner — executes the plugin from source via ts-node.
import { execute } from '@oclif/core';
await execute({ development: true, dir: import.meta.url });
