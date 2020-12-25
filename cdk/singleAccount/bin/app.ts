#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { FargateVpclinkStack } from '../lib/fargate-vpclink-stack';
import { HttpApiStack } from '../lib/httpApi-stack';

const envUSA = { region: 'us-west-2' };

const app = new cdk.App();
const fargateVpclinkStack = new FargateVpclinkStack(app, 'FargateVpclinkStack', { env: envUSA });
new HttpApiStack(app, 'HttpApiStack', fargateVpclinkStack.httpVpcLink, fargateVpclinkStack.httpApiListener , { env: envUSA });

