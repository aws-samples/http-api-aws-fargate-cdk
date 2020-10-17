#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { HttpApiBlogCdkLatestStack } from '../lib/http-api-blog-cdk-latest-stack';

const app = new cdk.App();
new HttpApiBlogCdkLatestStack(app, 'HttpApiBlogCdkLatestStack');
