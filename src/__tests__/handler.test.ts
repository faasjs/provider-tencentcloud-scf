import Flow from '@faasjs/flow';
import { handler } from '../index';

describe('handler', function () {
  test('context', async function () {
    const flow = new Flow({
      resource: {
        handler
      }
    }, (event, context) => context, (event, context) => context);

    const res0 = await flow.createTrigger(0)({}, {});

    expect(res0).toHaveProperty('current');
    expect(res0.history).toHaveLength(1);

    const res1 = await flow.createTrigger(1)({}, res0);

    expect(res1.trackId).toEqual(res0.trackId);
    expect(res1.history).toHaveLength(2);
  });

  test('http', async function () {
    const trigger = new Flow({
      resource: {
        handler
      },
      triggers: {
        http: {},
      },
    }, (event) => event).createTrigger('http');

    const res = await trigger({
      body: 'body',
      headers: {
        'X-ID': 'id',
      },
      httpMethod: 'POST',
      queryString: {
        q: '1',
      },
    }, {});

    const body = JSON.parse(res.body);

    expect(res.statusCode).toEqual(200);
    expect(body.data).toEqual({
      body: 'body',
      header: {
        'X-ID': 'id',
      },
      method: 'POST',
      param: {},
      query: {
        q: '1',
      },
    });
  });
});
