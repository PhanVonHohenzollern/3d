#ifndef __GLE_VENTILATORS_H__
#define __GLE_VENTILATORS_H__

	// General Ventilators Elements
	void makeCV1(double diam1, double length1, double length2, double heightWidth, int n);
	void makeCV2(double d,double l2 ,int n);
	void makeCV3(double diam1, double diam2, double length1, double length2, double length3, int n);
	void makeRV1(double a, double b, double l, double flange_1 = 30, double flange_2 = 30);


	// made by Piotr Konieczny
	void makeCRAF(double d1, double d2, double d0, double h1, double h2, double l1, double l2, double l3, double l4, double d10, double r0, int n);
	void makeRRAF(double a, double b, double d1, double c, double d, double d0, double h1, double h2, double l1, double l2, double l3, double l4,
	              double d10, double r0, int n);

#endif
