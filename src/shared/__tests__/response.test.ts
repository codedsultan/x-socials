import { describe, it, expect, vi } from 'vitest';
import { sendSuccess, sendCreated, sendNoContent, sendError } from '../helpers/response';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

describe('response helpers', () => {
  it('sendSuccess sends 200 with success:true envelope', () => {
    const res = makeRes();
    sendSuccess(res, { id: '1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: '1' } }));
  });

  it('sendSuccess includes message when provided', () => {
    const res = makeRes();
    sendSuccess(res, null, { message: 'Done' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Done' }));
  });

  it('sendSuccess accepts custom status code', () => {
    const res = makeRes();
    sendSuccess(res, {}, { statusCode: 202 });
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('sendCreated sends 201', () => {
    const res = makeRes();
    sendCreated(res, { id: '2' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('sendNoContent sends 204 with no body', () => {
    const res = makeRes();
    sendNoContent(res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('sendError sends the correct status and success:false', () => {
    const res = makeRes();
    sendError(res, 404, 'Not found');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Not found' }));
  });
});
