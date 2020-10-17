import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as HttpApiBlogCdkLatest from '../lib/http-api-blog-cdk-latest-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new HttpApiBlogCdkLatest.HttpApiBlogCdkLatestStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
