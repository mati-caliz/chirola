import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { EmisoresModule } from '../emisores/emisores.module';

@Module({
  imports: [EmisoresModule],
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}
