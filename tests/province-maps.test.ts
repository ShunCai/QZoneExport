import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileWriter } from '../core/fs/writer';
import {
    PROVINCE_ADCODES,
    buildChinaCitiesScript,
    buildProvinceMapScript,
    exportChinaCitiesMap,
} from '../core/export/province-maps';

function fakeWriter(options: { exists: boolean }) {
    return {
        diskEnabled: true,
        downloadsEnabled: false,
        exists: vi.fn(async () => options.exists),
        writeText: vi.fn(async () => undefined),
    } as unknown as FileWriter & { writeText: ReturnType<typeof vi.fn>; exists: ReturnType<typeof vi.fn> };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('地图脚本生成', () => {
    it('全国市级脚本含 registerMap china-cities 与来源说明', () => {
        const script = buildChinaCitiesScript({ type: 'FeatureCollection', features: [] });
        expect(script).toContain("registerMap('china-cities'");
        expect(script).toContain('DataV.GeoAtlas');
        expect(script).toContain('FeatureCollection');
    });

    it('单省脚本含 adcode（保留给手动只放某几省）', () => {
        const script = buildProvinceMapScript(440000, { features: [] });
        expect(script).toContain("registerMap('440000'");
    });

    it('adcode 清单 33 个、唯一、不含台湾', () => {
        expect(PROVINCE_ADCODES.length).toBe(33);
        expect(new Set(PROVINCE_ADCODES).size).toBe(33);
        expect(PROVINCE_ADCODES).not.toContain(710000);
    });
});

describe('exportChinaCitiesMap', () => {
    it('已存在则跳过，不发请求', async () => {
        const writer = fakeWriter({ exists: true });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const result = await exportChinaCitiesMap(writer);
        expect(result.mode).toBe('skipped');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(writer.writeText).not.toHaveBeenCalled();
    });

    it('下载并写入单个 china-cities.js', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })));
        const writer = fakeWriter({ exists: false });
        const result = await exportChinaCitiesMap(writer);
        expect(result.mode).toBe('written');
        expect(writer.writeText).toHaveBeenCalledTimes(1);
        expect(writer.writeText.mock.calls[0]![1]).toBe('Common/vendor/maps/china-cities.js');
    });

    it('下载失败返回 failed，不抛异常', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
        const writer = fakeWriter({ exists: false });
        const result = await exportChinaCitiesMap(writer);
        expect(result.mode).toBe('failed');
        expect(result.reason).toContain('503');
    });
});
