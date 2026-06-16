import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { VehiclesService } from '../vehicles/vehicles.service';
import { SocketGateway } from '../socket/socket.gateway';

function parseValue(val: any): { isTime: boolean; value: number; timeStr: string } {
  if (val === null || val === undefined || val === '') {
    return { isTime: false, value: 0, timeStr: '' };
  }
  const str = String(val).trim().toUpperCase();
  const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/;
  const match = str.match(timeRegex);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3];
    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    return { isTime: true, value: hours + minutes / 60, timeStr: `${hh}:${mm}` };
  }
  const num = parseFloat(str);
  return { isTime: false, value: isNaN(num) ? 0 : num, timeStr: '' };
}

function calculateHoursFromData(data: any): { totalHours: number; processed: any } {
  if (data.registerType === 'trips') {
    const capacity = Number(data.capacity || 0);
    const trips = Number(data.trips || 0);
    return {
      totalHours: Number((capacity * trips).toFixed(2)),
      processed: {
        shift1Start: null,
        shift1End: null,
        startHourmeter: 0,
        endHourmeter: 0,
        shift2Start: null,
        shift2End: null,
        registerType: 'trips',
        trips,
        capacity
      }
    };
  }

  const isClockSaved = data.registerType === 'clock';
  const startVal = isClockSaved ? data.shift1Start : data.startHourmeter;
  const endVal = isClockSaved ? data.shift1End : data.endHourmeter;

  const startObj = parseValue(startVal);
  const endObj = parseValue(endVal);

  let part1Diff = 0;
  let isClockPart1 = false;
  let shift1Start: string | null = null;
  let shift1End: string | null = null;
  let startHourmeter = 0;
  let endHourmeter = 0;

  if (startObj.isTime && endObj.isTime) {
    part1Diff = endObj.value - startObj.value;
    if (part1Diff < 0) part1Diff += 24;
    shift1Start = startObj.timeStr;
    shift1End = endObj.timeStr;
    isClockPart1 = true;
  } else {
    part1Diff = endObj.value - startObj.value;
    if (part1Diff < 0) part1Diff = 0;
    startHourmeter = startObj.value;
    endHourmeter = endObj.value;
  }

  const part2StartObj = parseValue(data.shift2Start);
  const part2EndObj = parseValue(data.shift2End);
  let part2Diff = 0;
  let shift2Start: string | null = null;
  let shift2End: string | null = null;

  if (part2StartObj.isTime && part2EndObj.isTime) {
    part2Diff = part2EndObj.value - part2StartObj.value;
    if (part2Diff < 0) part2Diff += 24;
    shift2Start = part2StartObj.timeStr;
    shift2End = part2EndObj.timeStr;
  }

  return {
    totalHours: Number((part1Diff + part2Diff).toFixed(2)),
    processed: {
      shift1Start,
      shift1End,
      startHourmeter,
      endHourmeter,
      shift2Start,
      shift2End,
      registerType: isClockPart1 || shift2Start ? 'clock' : 'hourmeter'
    }
  };
}

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private workOrderRepository: Repository<WorkOrder>,
    private vehiclesService: VehiclesService,
    private socketGateway: SocketGateway,
  ) { }

  async findAll(): Promise<WorkOrder[]> {
    return this.workOrderRepository.find({
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<WorkOrder | null> {
    return this.workOrderRepository.findOne({ where: { id } });
  }

  async create(data: Partial<WorkOrder>): Promise<WorkOrder> {
    if (!data.vehicleId) {
      throw new BadRequestException('Se requiere asociar un vehículo.');
    }

    const vehicle = await this.vehiclesService.findOne(data.vehicleId);
    if (!vehicle) {
      throw new BadRequestException('Vehículo no encontrado.');
    }

    const isTruck = vehicle.deviceType === 'Camión Volteo';
    const calc = calculateHoursFromData({
      ...data,
      registerType: isTruck ? 'trips' : data.registerType,
      capacity: isTruck ? vehicle.capacity : 0,
      trips: isTruck ? data.trips : 0
    });

    // Auto-generar número de conduce secuencial si no se suministra
    if (!data.conduceNumber) {
      const res = await this.getNextConduceNumber();
      data.conduceNumber = res.nextNumber;
    }

    // Crear conduce en estado pendiente (sin cálculos definitivos y sin actualizar horómetro de la máquina)
    // Calcular tarifa horaria y costo al crear (para que la UI los muestre inmediatamente)
    const expenseTotal = Number(data.oil || 0) + Number(data.gasoil || 0) + Number(data.gasoline || 0);
    const hourlyRateCalc = Number(vehicle.hourlyRate);
    const totalAmountCalc = calc.totalHours * hourlyRateCalc;
    const workOrder = this.workOrderRepository.create({
      ...data,
      totalHours: calc.totalHours,
      shift1Start: calc.processed.shift1Start,
      shift1End: calc.processed.shift1End,
      shift2Start: calc.processed.shift2Start,
      shift2End: calc.processed.shift2End,
      startHourmeter: calc.processed.startHourmeter,
      endHourmeter: calc.processed.endHourmeter,
      registerType: calc.processed.registerType,
      trips: calc.processed.trips,
      capacity: calc.processed.capacity,
      hourlyRate: hourlyRateCalc,
      totalAmount: totalAmountCalc,
      totalFuelExpense: expenseTotal,
      oil: Number(data.oil || 0),
      gasoil: Number(data.gasoil || 0),
      gasoline: Number(data.gasoline || 0),
      status: 'pending',
    });

    const saved = await this.workOrderRepository.save(workOrder);

    // Cargar la entidad completa con la relación vehicle para que la UI disponga del equipo, tarifa horaria y costo calculado
    const fullOrder = await this.workOrderRepository.findOne({
      where: { id: saved.id },
      relations: { vehicle: true },
    });

    if (!fullOrder) {
      throw new BadRequestException('Error al cargar la orden de trabajo recién creada.');
    }

      // Emitir por WebSockets la orden completa (incluye vehicle)
      this.socketGateway.emitNewWorkOrder(fullOrder);

    return fullOrder!;
  }

  async approve(id: string): Promise<WorkOrder | null> {
    const workOrder = await this.findOne(id);
    if (!workOrder) {
      throw new BadRequestException('Conduce no encontrado.');
    }

    if (workOrder.status === 'approved') {
      return workOrder; // Ya aprobado
    }

    const vehicle = await this.vehiclesService.findOne(workOrder.vehicleId);
    if (!vehicle) {
      throw new BadRequestException('Vehículo asociado no encontrado.');
    }

    const calc = calculateHoursFromData(workOrder);
    const expenseTotal = Number(workOrder.oil || 0) + Number(workOrder.gasoil || 0) + Number(workOrder.gasoline || 0);
    const hourlyRate = Number(vehicle.hourlyRate);
    const totalAmount = calc.totalHours * hourlyRate;
    // Guardar gasto de combustible por separado
    workOrder.totalFuelExpense = expenseTotal;
    workOrder.totalHours = calc.totalHours;
    workOrder.shift1Start = calc.processed.shift1Start;
    workOrder.shift1End = calc.processed.shift1End;
    workOrder.shift2Start = calc.processed.shift2Start;
    workOrder.shift2End = calc.processed.shift2End;
    workOrder.startHourmeter = calc.processed.startHourmeter;
    workOrder.endHourmeter = calc.processed.endHourmeter;
    workOrder.registerType = calc.processed.registerType;
    workOrder.trips = calc.processed.trips;
    workOrder.capacity = calc.processed.capacity;
    workOrder.hourlyRate = hourlyRate;
    workOrder.totalAmount = totalAmount;
    workOrder.status = 'approved';

    const saved = await this.workOrderRepository.save(workOrder);

    // Actualizar horómetro de la máquina en la base de datos de manera definitiva
    // Si es de reloj, le sumamos las horas trabajadas. Si es de horómetro, reemplazamos por el valor final.
    // Si es de viajes, no modificamos el horómetro.
    const newHourmeter = workOrder.registerType === 'clock'
      ? Number(vehicle.currentHourmeter || 0) + calc.totalHours
      : workOrder.registerType === 'trips'
        ? Number(vehicle.currentHourmeter || 0)
        : Number(workOrder.endHourmeter || 0);

    await this.vehiclesService.update(vehicle.id, {
      currentHourmeter: newHourmeter,
    });

    // Avisar vía sockets del cambio de estado y actualización del horómetro
    // Obtener la orden completa con la relación vehicle para enviarla vía socket
    const approvedFullOrder = await this.workOrderRepository.findOne({
      where: { id: saved.id },
      relations: { vehicle: true },
    });
    // Emitir la orden completa (incluye vehicle) en el evento de aprobación
    this.socketGateway.server.emit('work_order_approved', approvedFullOrder!);


    return saved;
  }

  async getSummaryStats(): Promise<{ totalIncome: number; totalHours: number; totalFuelExpense: number }> {
    // Los reportes financieros solo toman en cuenta los conduces aprobados
    const orders = await this.workOrderRepository.find({ where: { status: 'approved' } });
    let totalIncome = 0;
    let totalHours = 0;
    let totalFuelExpense = 0;

    for (const o of orders) {
      totalIncome += Number(o.totalAmount || 0);
      totalHours += Number(o.totalHours || 0);
      totalFuelExpense += Number(o.totalFuelExpense || 0);
    }

    return { totalIncome, totalHours, totalFuelExpense };
  }

  async getNextConduceNumber(): Promise<{ nextNumber: string }> {
    const todayStr = new Date().toISOString().substring(0, 10).replace(/-/g, ''); // ej: 20260612
    const prefix = `COND-${todayStr}-`;

    // Buscar el último del día de hoy usando queryBuilder para usar LIKE
    const lastOrder = await this.workOrderRepository
      .createQueryBuilder('order')
      .where('order.conduceNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('order.createdAt', 'DESC')
      .getOne();

    let nextSeq = 1;
    if (lastOrder && lastOrder.conduceNumber) {
      const parts = lastOrder.conduceNumber.split('-');
      const lastSeqStr = parts[parts.length - 1];
      const lastSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const nextNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
    return { nextNumber };
  }

  async update(id: string, data: Partial<WorkOrder>): Promise<WorkOrder | null> {
    await this.workOrderRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.workOrderRepository.delete(id);
  }
}
