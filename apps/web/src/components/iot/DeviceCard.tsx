import type { DeviceDto, DeviceStatus } from '@smart-campus/shared-types';
import { SelectField } from '../SelectField';
import { DeleteAction, TableActions } from '../ActionButtons';

const statusStyle: Record<DeviceStatus, string> = {
  ONLINE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  OFFLINE: 'bg-slate-100 text-slate-600 border-slate-200',
  MAINTENANCE: 'bg-amber-50 text-amber-900 border-amber-200',
  UNKNOWN: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUSES: DeviceStatus[] = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN'];

type DeviceCardProps = {
  device: DeviceDto;
  onDelete?: (device: DeviceDto) => void | Promise<void>;
  onStatusChange?: (device: DeviceDto, status: DeviceStatus) => void | Promise<void>;
};

export function DeviceCard({ device, onDelete, onStatusChange }: DeviceCardProps) {
  return (
    <article className="surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-wide text-campus-teal">{device.code}</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-campus-ink">{device.name}</h3>
          <p className="mt-1 text-xs text-campus-deep/65">
            {device.type} · {device.room ? `${device.room.code} ${device.room.name}` : 'Sem sala'}
          </p>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusStyle[device.status]}`}>
          {device.status}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-campus-deep/70">
        <p>Tópico MQTT: {device.mqttTopic ?? '—'}</p>
        {device.sensors.length === 0 ? (
          <p>Sem sensores associados</p>
        ) : (
          device.sensors.map((s) => (
            <p key={s.id}>
              Sensor: {s.name} ({s.metric}
              {s.unit ? `, ${s.unit}` : ''})
            </p>
          ))
        )}
      </div>

      {onStatusChange || onDelete ? (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-campus-line/60 pt-3">
          {onStatusChange ? (
            <SelectField
              size="sm"
              className="max-w-[11rem]"
              value={device.status}
              onChange={(status) => onStatusChange(device, status as DeviceStatus)}
              aria-label={`Estado de ${device.code}`}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          ) : (
            <span />
          )}
          {onDelete ? (
            <TableActions>
              <DeleteAction onClick={() => onDelete(device)} />
            </TableActions>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}