#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import { HttpApiStack } from '../lib/httpApi-stack';

const envUSA = { region: 'us-west-2' };

const app = new cdk.App();
const httpVpcLink = app.node.tryGetContext('httpVpcLink');
const httpApiListener = app.node.tryGetContext('httpApiListener');

new HttpApiStack(app, 'HttpApiStack', httpVpcLink, httpApiListener , { env: envUSA });

// public  httpVpcLink: cdk.CfnResource = '65vcat';
// public const httpApiListener: elbv2.ApplicationListener;

// httpVpcLink = 65vcat;
// new HttpApiStack(app, 'HttpApiStack', '65vcat', httpApiListener , { env: envUSA });



// arn:aws:elasticloadbalancing:us-west-2:082037726969:listener/app/Farga-httpa-UKHFB8SIA31L/9ae06a6f709fd03f/26bb62906e7b9b4a