import rp from 'request-promise';
import { format } from 'url';
import { get, listen } from '../server/app';

const port = get('port') || 3030;
const getUrl = (pathname) =>
  format({
    hostname: get('host') || 'localhost',
    protocol: 'http',
    port,
    pathname,
  });

describe('Feathers application tests (with jest)', () => {
  beforeAll((done) => {
    this.server = listen(port);
    this.server.once('listening', () => done());
  });

  afterAll((done) => {
    this.server.close(done);
  });

  it('starts and shows the index page', () => {
    expect.assertions(1);
    return rp(getUrl()).then((body) =>
      expect(body.indexOf('<html>')).not.toBe(-1)
    );
  });

  describe('404', () => {
    it('shows a 404 HTML page', () => {
      expect.assertions(2);
      return rp({
        url: getUrl('path/to/nowhere'),
        headers: {
          Accept: 'text/html',
        },
      }).catch((res) => {
        expect(res.statusCode).toBe(404);
        expect(res.error.indexOf('<html>')).not.toBe(-1);
      });
    });

    it('shows a 404 JSON error without stack trace', () => {
      expect.assertions(4);
      return rp({
        url: getUrl('path/to/nowhere'),
        json: true,
      }).catch((res) => {
        expect(res.statusCode).toBe(404);
        expect(res.error.code).toBe(404);
        expect(res.error.message).toBe('Page not found');
        expect(res.error.name).toBe('NotFound');
      });
    });
  });
});
