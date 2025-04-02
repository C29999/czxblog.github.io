#include <stdio.h>
#include <stdlib.h> 
#define N 512  
int main(void)
{
    char buff[N];
    FILE *str = fopen("D:\\main.c", "r"); 
    if(str == NULL)
    {
        printf("打开文件错误");
        exit(0);
    }
    FILE *dest = fopen("D:\\copy.c", "w");  
    if(dest == NULL)
    {
        printf("打开文件错误");
        exit(0);
    }
    while(fgets(buff, N, str) != NULL) 
    {
        fputs(buff, dest); 
    }
    fclose(str); 
    fclose(dest); 

    return 0;
}