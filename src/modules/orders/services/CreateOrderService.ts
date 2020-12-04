import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Invalid customer');
    }

    const allProducts = await this.productsRepository.findAllById(products);

    if (allProducts.length !== products.length) {
      throw new AppError('Invalid products');
    }

    const productsWithInvalidQuantity = allProducts.filter(product => {
      return (
        products.filter(
          p => p.id === product.id && p.quantity > product.quantity,
        ).length > 0
      );
    });

    if (productsWithInvalidQuantity.length > 0) {
      throw new AppError(`Invalid quantity - ${productsWithInvalidQuantity}`);
    }

    const parsedProducts = products.map(product => {
      return {
        product_id: product.id,
        quantity: product.quantity,
        price: allProducts.filter(p => p.id === product.id)[0].price,
      };
    });

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: parsedProducts,
    });

    const { order_products } = order;

    const updatedQuantity = order_products.map(orderProduct => {
      return {
        id: orderProduct.product_id,
        quantity:
          allProducts.filter(p => p.id === orderProduct.product_id)[0]
            .quantity - orderProduct.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updatedQuantity);

    return order;
  }
}

export default CreateOrderService;
